import { requireAdmin } from "@/lib/admin/requireAdmin";
import AdminNav from "./AdminNav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireAdmin();

  return (
    <div className="min-h-full bg-[var(--jaddid-surface)]">
      <AdminNav fullName={profile?.full_name || "المسؤول"} />
      {children}
    </div>
  );
}
