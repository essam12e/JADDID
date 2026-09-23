import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TemplateForm from "../TemplateForm";

export default async function NewTemplatePage() {
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

  if (!membership) redirect("/onboarding");

  return (
    <main className="mx-auto max-w-lg px-4 py-8 sm:px-8">
      <Link href="/dashboard/templates" className="text-sm text-slate-500 hover:text-slate-700">
        ← العودة للقوالب
      </Link>
      <h1 className="mt-2 mb-6 text-xl font-bold text-[var(--jaddid-navy)]">قالب رسالة جديد</h1>
      <div className="rounded-2xl border border-[var(--jaddid-border)] bg-white p-5 shadow-sm">
        <TemplateForm organizationId={membership.organization_id} />
      </div>
    </main>
  );
}
