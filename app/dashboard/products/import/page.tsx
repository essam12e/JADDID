import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ImportRunner from "./ImportRunner";

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{ storeId?: string }>;
}) {
  const { storeId } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!storeId) redirect("/dashboard/products");

  const { data: store } = await supabase
    .from("stores")
    .select("id, name, url")
    .eq("id", storeId)
    .maybeSingle();

  if (!store || !store.url) redirect("/dashboard/products");

  return (
    <main className="mx-auto max-w-lg px-4 py-10 sm:px-8">
      <h1 className="mb-2 text-xl font-bold text-[var(--jaddid-navy)]">
        إعادة استيراد منتجات {store.name}
      </h1>
      <p className="mb-6 text-sm text-slate-500" dir="ltr">
        {store.url}
      </p>
      <ImportRunner storeId={store.id} storeUrl={store.url} />
    </main>
  );
}
