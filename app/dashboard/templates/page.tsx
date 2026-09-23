import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import TemplateActions from "./TemplateActions";

export default async function TemplatesPage() {
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
      <main className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-lg font-bold text-[var(--jaddid-navy)]">لا يوجد متجر بعد</p>
        <Link
          href="/onboarding"
          className="mt-4 inline-block rounded-xl px-5 py-2.5 text-sm font-bold text-white"
          style={{ background: "var(--gradient-brand)" }}
        >
          إكمال الإعداد
        </Link>
      </main>
    );
  }

  const { data: templates } = await supabase
    .from("message_templates")
    .select("id, name, body, trigger_days, is_active")
    .eq("organization_id", membership.organization_id)
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[var(--jaddid-navy)]">قوالب رسائل واتساب</h1>
          <p className="text-sm text-slate-500">
            رسائل جاهزة تُفتح داخل واتساب مع تعبئة بيانات العميل تلقائيًا — أنت من يضغط إرسال.
          </p>
        </div>
        <Link
          href="/dashboard/templates/new"
          className="rounded-xl px-4 py-2 text-sm font-bold text-white"
          style={{ background: "var(--gradient-brand)" }}
        >
          + قالب جديد
        </Link>
      </div>

      {!templates || templates.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-[var(--jaddid-border)] bg-white px-6 py-16 text-center">
          <p className="text-lg font-bold text-[var(--jaddid-navy)]">لا توجد قوالب بعد</p>
          <p className="mt-1 text-sm text-slate-500">أنشئ أول قالب تذكير لاستخدامه في صفحة التجديدات.</p>
          <Link
            href="/dashboard/templates/new"
            className="mt-5 rounded-xl px-5 py-2.5 text-sm font-bold text-white"
            style={{ background: "var(--gradient-brand)" }}
          >
            + قالب جديد
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => (
            <div key={t.id} className="rounded-2xl border border-[var(--jaddid-border)] bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-[var(--jaddid-navy)]">{t.name}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        t.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {t.is_active ? "مفعّل" : "معطّل"}
                    </span>
                    {t.trigger_days != null ? (
                      <span className="rounded-full bg-[var(--jaddid-surface)] px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                        قبل {t.trigger_days} يوم
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm text-slate-500">{t.body}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <Link
                    href={`/dashboard/templates/${t.id}/edit`}
                    className="rounded-lg bg-[var(--jaddid-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--jaddid-blue)]"
                  >
                    تعديل
                  </Link>
                  <TemplateActions templateId={t.id} isActive={t.is_active} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
