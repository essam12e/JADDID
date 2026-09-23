import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ProductImage from "@/components/dashboard/ProductImage";

type ProductRow = {
  id: string;
  name: string;
  image_url: string | null;
  price: number | null;
  currency: string;
  source_url: string | null;
  renewal_url: string | null;
};

export default async function ProductsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return (
      <EmptyState
        title="لا يوجد متجر بعد"
        description="أكمل خطوات الإعداد أولًا لإنشاء متجرك."
        actionHref="/onboarding"
        actionLabel="إكمال الإعداد"
      />
    );
  }

  const { data: store } = await supabase
    .from("stores")
    .select("id, name, url")
    .eq("organization_id", membership.organization_id)
    .limit(1)
    .maybeSingle();

  if (!store) {
    return (
      <EmptyState
        title="لا يوجد متجر بعد"
        description="أكمل خطوات الإعداد أولًا لإنشاء متجرك."
        actionHref="/onboarding"
        actionLabel="إكمال الإعداد"
      />
    );
  }

  const { data: products } = await supabase
    .from("products")
    .select("id, name, image_url, price, currency, source_url, renewal_url")
    .eq("store_id", store.id)
    .eq("is_archived", false)
    .order("created_at", { ascending: false });

  const { data: subs } = await supabase
    .from("subscriptions")
    .select("product_id, customer_id, status, end_date")
    .eq("store_id", store.id);

  const today = new Date();
  const in7Days = new Date(today);
  in7Days.setDate(in7Days.getDate() + 7);

  const statsByProduct = new Map<
    string,
    { customers: Set<string>; active: number; expiringSoon: number }
  >();

  for (const s of subs ?? []) {
    if (!statsByProduct.has(s.product_id)) {
      statsByProduct.set(s.product_id, { customers: new Set(), active: 0, expiringSoon: 0 });
    }
    const stat = statsByProduct.get(s.product_id)!;
    stat.customers.add(s.customer_id);
    if (s.status === "active") {
      stat.active++;
      const end = new Date(s.end_date);
      if (end >= today && end <= in7Days) stat.expiringSoon++;
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[var(--jaddid-navy)]">
            منتجات {store.name}
          </h1>
          <p className="text-sm text-slate-500">
            {products?.length ?? 0} منتج
          </p>
        </div>
        <div className="flex gap-2">
          {store.url ? (
            <Link
              href={`/dashboard/products/import?storeId=${store.id}`}
              className="rounded-xl border border-[var(--jaddid-border)] bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              إعادة الاستيراد
            </Link>
          ) : null}
          <Link
            href="/dashboard/products/new"
            className="rounded-xl px-4 py-2 text-sm font-bold text-white"
            style={{ background: "var(--gradient-brand)" }}
          >
            + إضافة منتج
          </Link>
        </div>
      </div>

      {!products || products.length === 0 ? (
        <EmptyState
          title="لم نستورد منتجات بعد"
          description="استورد منتجاتك من رابط متجرك أو أضفها يدويًا."
          actionHref="/dashboard/products/new"
          actionLabel="إضافة منتج"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product: ProductRow) => {
            const stat = statsByProduct.get(product.id);
            return (
              <div
                key={product.id}
                className="rounded-2xl border border-[var(--jaddid-border)] bg-white p-4 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <ProductImage src={product.image_url} alt={product.name} />
                  <div className="min-w-0">
                    <p className="truncate font-bold text-[var(--jaddid-navy)]">
                      {product.name}
                    </p>
                    <p className="text-sm text-slate-500">
                      {product.price != null ? `${product.price} ${product.currency}` : "بدون سعر"}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                  <span>{stat?.customers.size ?? 0} عميل</span>
                  <span>{stat?.active ?? 0} اشتراك نشط</span>
                  {stat && stat.expiringSoon > 0 ? (
                    <span className="font-semibold text-amber-600">
                      {stat.expiringSoon} تنتهي قريبًا
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={`/dashboard/products/${product.id}/sell`}
                    className="rounded-lg bg-[var(--jaddid-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--jaddid-blue)]"
                  >
                    تسجيل عملية بيع
                  </Link>
                  <Link
                    href={`/dashboard/products/${product.id}/customers`}
                    className="rounded-lg bg-[var(--jaddid-surface)] px-3 py-1.5 text-xs font-semibold text-slate-500"
                  >
                    العملاء
                  </Link>
                  <Link
                    href={`/dashboard/products/${product.id}/edit`}
                    className="rounded-lg bg-[var(--jaddid-surface)] px-3 py-1.5 text-xs font-semibold text-slate-500"
                  >
                    تعديل
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

function EmptyState({
  title,
  description,
  actionHref,
  actionLabel,
}: {
  title: string;
  description: string;
  actionHref: string;
  actionLabel: string;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-[var(--jaddid-border)] bg-white px-6 py-16 text-center">
      <p className="text-lg font-bold text-[var(--jaddid-navy)]">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
      <Link
        href={actionHref}
        className="mt-5 rounded-xl px-5 py-2.5 text-sm font-bold text-white"
        style={{ background: "var(--gradient-brand)" }}
      >
        {actionLabel}
      </Link>
    </div>
  );
}
