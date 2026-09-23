import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/requireAdmin";

const STATUS_LABELS: Record<string, string> = {
  pending_activation: "بانتظار التفعيل",
  active: "نشط",
  suspended: "موقوف",
  rejected: "مرفوض",
  expired: "منتهٍ",
};

const ROLE_LABELS: Record<string, string> = {
  owner: "مالك",
  admin: "مدير",
  staff: "موظف",
  viewer: "مشاهد",
};

export default async function AdminOrganizationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireAdmin();

  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, account_number, status, created_at")
    .eq("id", id)
    .maybeSingle();

  if (!org) notFound();

  const [
    { data: members },
    { data: subscription },
    { data: stores },
    { data: activationRequests },
    { data: auditLogs },
    { count: customersCount },
    { count: subscriptionsCount },
  ] = await Promise.all([
    supabase.from("organization_members").select("role, user_id").eq("organization_id", id),
    supabase
      .from("account_subscriptions")
      .select("status, started_at, expires_at, created_at, plans(name, price, currency)")
      .eq("organization_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("stores").select("id, name, url, created_at").eq("organization_id", id),
    supabase
      .from("activation_requests")
      .select("id, status, note, created_at, reviewed_at")
      .eq("organization_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("audit_logs")
      .select("id, action, target_type, target_id, metadata, created_at, actor_id")
      .eq("organization_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", id),
    supabase
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", id),
  ]);

  // organization_members.user_id and audit_logs.actor_id both reference
  // auth.users, not profiles, directly -- there's no FK between them and
  // `profiles` for PostgREST to embed through. Resolve names with a
  // separate lookup instead of relying on an embed that has no
  // relationship to traverse.
  const actorIds = new Set<string>();
  for (const m of members ?? []) actorIds.add(m.user_id);
  for (const log of auditLogs ?? []) if (log.actor_id) actorIds.add(log.actor_id);

  const { data: actorProfiles } =
    actorIds.size > 0
      ? await supabase.from("profiles").select("id, full_name").in("id", Array.from(actorIds))
      : { data: [] as { id: string; full_name: string }[] };

  const nameById = new Map((actorProfiles ?? []).map((p) => [p.id, p.full_name]));

  const plan = Array.isArray(subscription?.plans) ? subscription.plans[0] : subscription?.plans;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-8">
      <Link href="/admin/organizations" className="mb-4 inline-block text-xs font-semibold text-slate-500 hover:text-[var(--jaddid-blue)]">
        ← رجوع لكل المؤسسات
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[var(--jaddid-navy)]">{org.name}</h1>
          <p className="text-sm text-slate-500" dir="ltr">
            رقم الحساب: {org.account_number}
          </p>
        </div>
        <span className="rounded-full bg-[var(--jaddid-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--jaddid-navy)]">
          {STATUS_LABELS[org.status] ?? org.status}
        </span>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <StatCard label="المتاجر" value={stores?.length ?? 0} />
        <StatCard label="الأعضاء" value={members?.length ?? 0} />
        <StatCard label="العملاء" value={customersCount ?? 0} />
        <StatCard label="الاشتراكات" value={subscriptionsCount ?? 0} />
      </div>

      <Section title="الباقة والاشتراك">
        {plan ? (
          <div className="text-sm text-slate-600">
            <p>
              <span className="font-semibold text-[var(--jaddid-navy)]">{plan.name}</span> —{" "}
              {plan.price} {plan.currency}
            </p>
            <p className="mt-1 text-xs text-slate-400" dir="ltr">
              {subscription?.started_at
                ? `بدأ: ${new Date(subscription.started_at).toLocaleDateString("ar-SA")}`
                : "لم يبدأ بعد"}
              {subscription?.expires_at
                ? ` · ينتهي: ${new Date(subscription.expires_at).toLocaleDateString("ar-SA")}`
                : ""}
            </p>
          </div>
        ) : (
          <p className="text-sm text-slate-400">لا يوجد اشتراك مسجّل.</p>
        )}
      </Section>

      <Section title="المتاجر">
        {!stores || stores.length === 0 ? (
          <p className="text-sm text-slate-400">لا توجد متاجر بعد.</p>
        ) : (
          <ul className="space-y-1.5 text-sm text-slate-600">
            {stores.map((s) => (
              <li key={s.id} className="flex items-center justify-between">
                <span className="font-semibold text-[var(--jaddid-navy)]">{s.name}</span>
                {s.url ? (
                  <span className="text-xs text-slate-400" dir="ltr">
                    {s.url}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="الأعضاء">
        {!members || members.length === 0 ? (
          <p className="text-sm text-slate-400">لا يوجد أعضاء.</p>
        ) : (
          <ul className="space-y-1.5 text-sm text-slate-600">
            {members.map((m) => (
              <li key={m.user_id} className="flex items-center justify-between">
                <span>{nameById.get(m.user_id) || "بدون اسم"}</span>
                <span className="rounded-full bg-[var(--jaddid-surface)] px-2 py-0.5 text-xs font-semibold text-slate-500">
                  {ROLE_LABELS[m.role] ?? m.role}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="سجل طلبات التفعيل">
        {!activationRequests || activationRequests.length === 0 ? (
          <p className="text-sm text-slate-400">لا يوجد سجل بعد.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {activationRequests.map((r) => (
              <li key={r.id} className="rounded-lg bg-[var(--jaddid-surface)] p-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[var(--jaddid-navy)]">
                    {r.status === "pending" ? "بانتظار المراجعة" : r.status === "approved" ? "تمت الموافقة" : "مرفوض"}
                  </span>
                  <span className="text-xs text-slate-400" dir="ltr">
                    {new Date(r.created_at).toLocaleString("ar-SA")}
                  </span>
                </div>
                {r.note ? <p className="mt-1 text-xs text-slate-500">{r.note}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="سجل الإجراءات الإدارية (Audit Log)">
        {!auditLogs || auditLogs.length === 0 ? (
          <p className="text-sm text-slate-400">لا يوجد سجل إجراءات إدارية بعد.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[var(--jaddid-border)]">
            <table className="w-full text-xs">
              <thead className="bg-[var(--jaddid-surface)] text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-right font-medium">الإجراء</th>
                  <th className="px-3 py-2 text-right font-medium">بواسطة</th>
                  <th className="px-3 py-2 text-right font-medium">التاريخ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--jaddid-border)]">
                {auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="px-3 py-2 text-slate-600">
                      {log.action}
                      {log.target_type ? ` · ${log.target_type}` : ""}
                    </td>
                    <td className="px-3 py-2 text-slate-500">
                      {(log.actor_id && nameById.get(log.actor_id)) || "—"}
                    </td>
                    <td className="px-3 py-2 text-slate-400" dir="ltr">
                      {new Date(log.created_at).toLocaleString("ar-SA")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-[var(--jaddid-border)] bg-white p-4 text-center">
      <p className="text-xl font-extrabold text-[var(--jaddid-navy)]">{value}</p>
      <p className="mt-0.5 text-xs text-slate-500">{label}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="mb-2 text-sm font-bold text-[var(--jaddid-navy)]">{title}</h2>
      <div className="rounded-2xl border border-[var(--jaddid-border)] bg-white p-4">
        {children}
      </div>
    </div>
  );
}
