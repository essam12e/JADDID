import SettingsTabs from "./SettingsTabs";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-8">
      <h1 className="mb-1 text-xl font-bold text-[var(--jaddid-navy)]">الإعدادات</h1>
      <p className="mb-6 text-sm text-slate-500">إدارة حسابك ومتجرك وأمان تسجيل الدخول.</p>
      <SettingsTabs />
      <div className="mt-6">{children}</div>
    </main>
  );
}
