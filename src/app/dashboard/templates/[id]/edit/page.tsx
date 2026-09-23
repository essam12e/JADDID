import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TemplateForm from "../../TemplateForm";

export default async function EditTemplatePage({
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

  // RLS-scoped: null if this template doesn't belong to the caller's org.
  const { data: template } = await supabase
    .from("message_templates")
    .select("id, organization_id, name, body, trigger_days, is_active")
    .eq("id", id)
    .maybeSingle();

  if (!template) notFound();

  return (
    <main className="mx-auto max-w-lg px-4 py-8 sm:px-8">
      <Link href="/dashboard/templates" className="text-sm text-slate-500 hover:text-slate-700">
        ← العودة للقوالب
      </Link>
      <h1 className="mt-2 mb-6 text-xl font-bold text-[var(--jaddid-navy)]">تعديل القالب</h1>
      <div className="rounded-2xl border border-[var(--jaddid-border)] bg-white p-5 shadow-sm">
        <TemplateForm organizationId={template.organization_id} existing={template} />
      </div>
    </main>
  );
}
