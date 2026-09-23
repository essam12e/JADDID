import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProductForm from "../ProductForm";

export default async function NewProductPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  const { data: store } = membership
    ? await supabase
        .from("stores")
        .select("id")
        .eq("organization_id", membership.organization_id)
        .limit(1)
        .maybeSingle()
    : { data: null };

  if (!store) redirect("/onboarding");

  return (
    <main className="mx-auto max-w-lg px-4 py-8 sm:px-8">
      <h1 className="mb-6 text-xl font-bold text-[var(--jaddid-navy)]">
        إضافة منتج يدويًا
      </h1>
      <ProductForm storeId={store.id} organizationId={membership!.organization_id} />
    </main>
  );
}
