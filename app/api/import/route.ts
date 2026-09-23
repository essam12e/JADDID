import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { startImportSchema } from "@/lib/validations/import";
import { importFromUrl } from "@/lib/importer";

export const maxDuration = 60;

const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const RATE_LIMIT_MAX_PER_WINDOW = 3;

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

  const outcome = await importFromUrl(sourceUrl);

  if (!outcome.ok) {
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
      attempts: outcome.attempts,
    });
  }

  let imported = 0;
  let unchanged = 0;
  let failed = 0;

  for (const product of outcome.products) {
    try {
      const { data: existing } = await supabase
        .from("products")
        .select("id, name, price, image_url, description, is_available")
        .eq("store_id", store.id)
        .eq("source_fingerprint", product.fingerprint)
        .maybeSingle();

      if (!existing) {
        const { error: insertError } = await supabase.from("products").insert({
          organization_id: store.organization_id,
          store_id: store.id,
          name: product.name,
          description: product.description,
          image_url: product.imageUrl,
          price: product.price,
          currency: product.currency ?? "SAR",
          source_url: product.sourceUrl,
          renewal_url: product.sourceUrl,
          source_fingerprint: product.fingerprint,
          is_available: product.isAvailable,
        });
        if (insertError) throw insertError;
        imported++;
        continue;
      }

      const changed =
        existing.name !== product.name ||
        Number(existing.price) !== product.price ||
        existing.image_url !== product.imageUrl ||
        existing.description !== product.description ||
        existing.is_available !== product.isAvailable;

      if (!changed) {
        unchanged++;
        continue;
      }

      const { error: updateError } = await supabase
        .from("products")
        .update({
          name: product.name,
          description: product.description,
          image_url: product.imageUrl,
          price: product.price,
          is_available: product.isAvailable,
        })
        .eq("id", existing.id);
      if (updateError) throw updateError;
      imported++;
    } catch {
      failed++;
    }
  }

  const finalStatus = failed === 0 ? "completed" : imported + unchanged > 0 ? "partial" : "failed";

  await supabase
    .from("import_jobs")
    .update({
      status: finalStatus,
      total_count: outcome.products.length,
      imported_count: imported,
      failed_count: failed,
      error_summary:
        failed > 0 ? `${failed} من ${outcome.products.length} منتجًا تعذّر حفظها` : null,
    })
    .eq("id", job.id);

  return NextResponse.json({
    jobId: job.id,
    status: finalStatus,
    total: outcome.products.length,
    imported,
    unchanged,
    failed,
    adapterUsed: outcome.adapterUsed,
  });
}
