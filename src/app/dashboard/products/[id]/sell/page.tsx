import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SaleForm from "./SaleForm";

export default async function SellProductPage({
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

  // RLS-scoped: returns null for a product outside the caller's org.
  const { data: product } = await supabase
    .from("products")
    .select("id, name, store_id")
    .eq("id", id)
    .maybeSingle();

  if (!product) notFound();

  return (
    <main className="mx-auto max-w-lg px-4 py-8 sm:px-8">
      <div className="mb-6">
        <Link href="/dashboard/products" className="text-sm text-slate-500 hover:text-slate-700">
          ← العودة للمنتجات
        </Link>
        <h1 className="mt-2 text-xl font-bold text-[var(--jaddid-navy)]">
          تسجيل عملية بيع — {product.name}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          يبحث النظام عن عميل بنفس رقم الجوال في هذا المتجر؛ إن وُجد يُستخدم
          سجله الحالي، وإلا يتم إنشاء عميل جديد.
        </p>
      </div>

      <div className="rounded-2xl border border-[var(--jaddid-border)] bg-white p-5 shadow-sm">
        <SaleForm storeId={product.store_id} productId={product.id} productName={product.name} />
      </div>
    </main>
  );
}
