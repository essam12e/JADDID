import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import StoreForm from "./StoreForm";

export default async function StoreSettingsPage() {
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

  if (!membership) {
    return (
      <p className="rounded-2xl border border-dashed border-[var(--jaddid-border)] bg-white p-6 text-center text-sm text-slate-500">
        أكمل إعداد متجرك أولًا من صفحة الإعداد.
      </p>
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
      <p className="rounded-2xl border border-dashed border-[var(--jaddid-border)] bg-white p-6 text-center text-sm text-slate-500">
        أكمل إعداد متجرك أولًا من صفحة الإعداد.
      </p>
    );
  }

  return (
    <StoreForm storeId={store.id} initialName={store.name} initialUrl={store.url ?? ""} />
  );
}
