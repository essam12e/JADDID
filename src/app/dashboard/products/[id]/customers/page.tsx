import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function ProductCustomersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: product } = await supabase
    .from("products")
    .select("id, name")
    .eq("id", id)
    .maybeSingle();

  if (!product) notFound();

  return (
    <main className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-lg font-bold text-[var(--jaddid-navy)]">
        عملاء {product.name}
      </h1>
      <p className="mt-3 rounded-lg bg-amber-50 px-3 py-3 text-sm leading-6 text-amber-700">
        صفحة العملاء والاشتراكات قيد البناء في المرحلة التالية.
      </p>
      <Link
        href="/dashboard/products"
        className="mt-6 inline-block rounded-xl border border-[var(--jaddid-border)] px-5 py-2.5 text-sm font-semibold text-slate-600"
      >
        العودة للمنتجات
      </Link>
    </main>
  );
}
