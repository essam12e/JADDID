import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { startImportSchema, DEFAULT_IMPORT_LIMIT } from "@/lib/validations/import";
import { importFromUrl } from "@/lib/importer";

export const maxDuration = 60;

/**
 * How long the crawl may run before it hands back what it has.
 *
 * The function is capped at 60s; the database writes and the job
 * bookkeeping need the rest. A store with hundreds of products is read
 * across runs, each one skipping the pages already stored.
 */
const CRAWL_BUDGET_MS = 40_000;

/** Rows per write. PostgREST handles a few hundred comfortably. */
const WRITE_CHUNK = 200;

const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
// A large catalogue is read across several passes — the crawl is capped
// by the function's lifetime and paced by the store's own rate limit —
// so the window has to allow a continuation to finish. Each pass is
// itself bounded, so this is still a ceiling on outbound traffic.
const RATE_LIMIT_MAX_PER_WINDOW = 25;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "authentication required" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = startImportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" },
      { status: 400 },
    );
  }
  const { storeId, sourceUrl } = parsed.data;
  const limit = parsed.data.limit ?? DEFAULT_IMPORT_LIMIT;

  // RLS-scoped: this returns null if the caller isn't a member of the
  // org that owns this store, which we treat as "not found" rather than
  // leaking whether the store id exists at all.
  const { data: store } = await supabase
    .from("stores")
    .select("id, organization_id")
    .eq("id", storeId)
    .maybeSingle();

  if (!store) {
    return NextResponse.json({ error: "المتجر غير موجود" }, { status: 404 });
  }

  // Rate limit: the importer fetches an external URL and writes to the
  // database on every call, so an uncapped endpoint is both an abuse
  // vector (repeatedly hitting arbitrary external hosts through this
  // server) and a cost/DoS concern. There's no separate infra for this
  // (no Redis), so it's enforced against the import_jobs table that
  // already logs every attempt -- no new table, and the count is
  // per-store so one store's retries can't exhaust another's quota.
  const rateLimitWindowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const { count: recentJobCount } = await supabase
    .from("import_jobs")
    .select("id", { count: "exact", head: true })
    .eq("store_id", store.id)
    .gte("created_at", rateLimitWindowStart);

  if ((recentJobCount ?? 0) >= RATE_LIMIT_MAX_PER_WINDOW) {
    return NextResponse.json(
      { error: "عدد كبير من محاولات الاستيراد خلال وقت قصير. يرجى المحاولة لاحقًا." },
      { status: 429 },
    );
  }

  const { data: job, error: jobError } = await supabase
    .from("import_jobs")
    .insert({
      organization_id: store.organization_id,
      store_id: store.id,
      source_url: sourceUrl,
      status: "processing",
    })
    .select("id")
    .single();

  if (jobError || !job) {
    return NextResponse.json({ error: "تعذّر بدء عملية الاستيراد" }, { status: 500 });
  }

  // Read the store's current products once, up front: it tells the crawl
  // which pages it can skip, and it replaces the per-product SELECT that
  // used to run inside the write loop.
  const { data: existingRows } = await supabase
    .from("products")
    .select("id, name, price, image_url, description, is_available, source_fingerprint, source_url")
    .eq("store_id", store.id);

  const byFingerprint = new Map(
    (existingRows ?? [])
      .filter((row) => row.source_fingerprint)
      .map((row) => [row.source_fingerprint as string, row]),
  );
  const knownSourceUrls = new Set(
    (existingRows ?? []).map((row) => row.source_url).filter((url): url is string => !!url),
  );

  const outcome = await importFromUrl(sourceUrl, {
    deadline: Date.now() + CRAWL_BUDGET_MS,
    knownSourceUrls,
    // Reading more pages than the merchant asked for is wasted traffic
    // against their store, so the crawl is capped too, not just the
    // number of rows we keep.
    maxPages: limit,
  });

  if (!outcome.ok) {
    // The general adapter is the one that actually tried to read the
    // store; "this isn't Shopify" is bookkeeping, not an explanation.
    const userReason =
      outcome.attempts.find((a) => a.adapter === "storefront")?.reason ??
      outcome.attempts[0]?.reason ??
      "تعذّر الاستيراد من هذا الرابط.";
    const reason = outcome.attempts.map((a) => `${a.adapter}: ${a.reason}`).join(" | ");
    await supabase
      .from("import_jobs")
      .update({
        status: "failed",
        total_count: 0,
        error_summary: reason.slice(0, 1000),
      })
      .eq("id", job.id);

    return NextResponse.json({
      jobId: job.id,
      status: "failed",
      total: 0,
      imported: 0,
      unchanged: 0,
      failed: 0,
      reason: userReason,
      attempts: outcome.attempts,
    });
  }

  // One product reachable from two URLs would otherwise hit the same
  // conflict target twice in one statement, which Postgres rejects.
  const products = [...new Map(outcome.products.map((p) => [p.fingerprint, p])).values()].slice(
    0,
    limit,
  );

  type InsertRow = {
    organization_id: string;
    store_id: string;
    name: string;
    description: string | null;
    image_url: string | null;
    price: number | null;
    currency: string;
    source_url: string;
    renewal_url: string;
    source_fingerprint: string;
    is_available: boolean | null;
  };

  const toInsert: InsertRow[] = [];
  const toUpdate: (InsertRow & { id: string })[] = [];
  let unchanged = 0;

  for (const product of products) {
    const row: InsertRow = {
      organization_id: store.organization_id,
      store_id: store.id,
      name: product.name,
      description: product.description ?? null,
      image_url: product.imageUrl ?? null,
      price: product.price ?? null,
      currency: product.currency ?? "SAR",
      source_url: product.sourceUrl,
      renewal_url: product.sourceUrl,
      source_fingerprint: product.fingerprint,
      is_available: product.isAvailable ?? null,
    };

    const existing = byFingerprint.get(product.fingerprint);
    if (!existing) {
      toInsert.push(row);
      continue;
    }

    const changed =
      existing.name !== row.name ||
      Number(existing.price) !== row.price ||
      existing.image_url !== row.image_url ||
      existing.description !== row.description ||
      existing.is_available !== row.is_available;

    if (changed) toUpdate.push({ ...row, id: existing.id });
    else unchanged++;
  }

  let imported = 0;
  let failed = 0;

  for (let i = 0; i < toInsert.length; i += WRITE_CHUNK) {
    const chunk = toInsert.slice(i, i + WRITE_CHUNK);
    const { error } = await supabase.from("products").insert(chunk);
    if (error) failed += chunk.length;
    else imported += chunk.length;
  }

  // Upsert on the primary key: every row here already exists, so this is
  // an update — batched, instead of one round trip per product.
  for (let i = 0; i < toUpdate.length; i += WRITE_CHUNK) {
    const chunk = toUpdate.slice(i, i + WRITE_CHUNK);
    const { error } = await supabase.from("products").upsert(chunk);
    if (error) failed += chunk.length;
    else imported += chunk.length;
  }

  // Products that were read are saved and counted, whether or not the
  // crawl got through the whole catalogue. "More to read" is progress,
  // not failure — only rows we could not store are.
  const finalStatus =
    failed > 0 ? (imported + unchanged > 0 ? "partial" : "failed") : "completed";

  await supabase
    .from("import_jobs")
    .update({
      status: finalStatus,
      total_count: products.length,
      imported_count: imported,
      failed_count: failed,
      error_summary:
        failed > 0
          ? `${failed} من ${products.length} منتجًا تعذّر حفظها`
          : outcome.partial
            ? `بقي ${outcome.remaining} صفحة منتج — شغّل الاستيراد مرة ثانية عشان يكمل`
            : null,
    })
    .eq("id", job.id);

  return NextResponse.json({
    jobId: job.id,
    status: finalStatus,
    total: products.length,
    imported,
    unchanged,
    failed,
    adapterUsed: outcome.adapterUsed,
    partial: outcome.partial ?? false,
    remaining: outcome.remaining ?? 0,
  });
}
