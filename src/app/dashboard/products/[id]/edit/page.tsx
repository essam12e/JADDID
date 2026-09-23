import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProductForm from "../../ProductForm";

export default async function EditProductPage({
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

  // RLS-scoped: returns null if this product doesn't belong to an org
  // the caller is a member of, which we treat as not-found.
  const { data: product } = await supabase
    .from("products")
    .select("id, name, description, price, image_url, renewal_url, source_url, store_id, organization_id")
    .eq("id", id)
    .maybeSingle();

  if (!product) notFound();

  return (
    <main className="mx-auto max-w-lg px-4 py-8 sm:px-8">
      <h1 className="mb-6 text-xl font-bold text-[var(--jaddid-navy)]">
        تعديل المنتج
      </h1>
      <ProductForm
        storeId={product.store_id}
        organizationId={product.organization_id}
        existing={product}
      />
    </main>
  );
}
