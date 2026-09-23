import { requireAdmin } from "@/lib/admin/requireAdmin";

const STATUS_LABELS: Record<string, string> = {
  pending_activation: "بانتظار التفعيل",
  active: "نشط",
  suspended: "موقوف",
  rejected: "مرفوض",
  expired: "منتهٍ",
};

const STATUS_STYLES: Record<string, string> = {
  pending_activation: "bg-amber-50 text-amber-700",
  active: "bg-emerald-50 text-emerald-700",
  suspended: "bg-slate-100 text-slate-500",
  rejected: "bg-red-50 text-red-700",
  expired: "bg-slate-100 text-slate-500",
};

export default async function AdminOrganizationsPage() {
  const { supabase } = await requireAdmin();

  const [{ data: organizations }, { data: members }] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, name, account_number, status, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("organization_members").select("organization_id, role, profiles(full_name)"),
  ]);

  const membersByOrg = new Map<string, { role: string; full_name: string }[]>();
  for (const m of members ?? []) {
    const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
    const list = membersByOrg.get(m.organization_id) ?? [];
    list.push({ role: m.role, full_name: profile?.full_name || "بدون اسم" });
    membersByOrg.set(m.organization_id, list);
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-8">
      <h1 className="mb-1 text-xl font-bold text-[var(--jaddid-navy)]">المؤسسات</h1>
      <p className="mb-6 text-sm text-slate-500">{organizations?.length ?? 0} مؤسسة مسجّلة على المنصة</p>

      {!organizations || organizations.length === 0 ? (
        <p className="text-sm text-slate-400">لا توجد مؤسسات بعد.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--jaddid-border)] bg-white">
          <table className="w-full text-sm">
            <thead className="bg-[var(--jaddid-surface)] text-slate-500">
              <tr>
                <th className="px-4 py-3 text-right font-medium">المؤسسة</th>
                <th className="px-4 py-3 text-right font-medium">رقم الحساب</th>
                <th className="px-4 py-3 text-right font-medium">المالك</th>
                <th className="px-4 py-3 text-right font-medium">الأعضاء</th>
                <th className="px-4 py-3 text-right font-medium">الحالة</th>
                <th className="px-4 py-3 text-right font-medium">تاريخ التسجيل</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--jaddid-border)]">
              {organizations.map((org) => {
                const orgMembers = membersByOrg.get(org.id) ?? [];
                const owner = orgMembers.find((m) => m.role === "owner");
                return (
                  <tr key={org.id}>
                    <td className="px-4 py-3 font-semibold text-[var(--jaddid-navy)]">{org.name}</td>
                    <td className="px-4 py-3 text-slate-500" dir="ltr">
                      {org.account_number}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{owner?.full_name ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-500">{orgMembers.length}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[org.status] ?? ""}`}
                      >
                        {STATUS_LABELS[org.status] ?? org.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500" dir="ltr">
                      {new Date(org.created_at).toLocaleDateString("ar-SA")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
