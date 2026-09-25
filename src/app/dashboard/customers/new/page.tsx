import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import CustomerForm from "../CustomerForm";

export const metadata: Metadata = { title: "إضافة عميل" };

/**
 * Adding a customer by hand.
 *
 * Until now a customer could only appear as a side effect of recording a
 * sale, so a merchant with a list of people to follow up had nowhere to
 * put them.
 */
export default async function NewCustomerPage() {
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

  const { data: stores } = await supabase
    .from("stores")
    .select("id, name")
    .eq("organization_id", membership.organization_id)
    .order("created_at", { ascending: true });

  if (!stores || stores.length === 0) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-lg font-bold text-[var(--jaddid-navy)]">لازم تضيف متجر أول</p>
        <p className="mt-1 text-sm text-slate-500">العميل لازم يكون تابعًا لمتجر.</p>
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

  return (
    <main className="mx-auto max-w-lg px-4 py-8 sm:px-8">
      <Link
        href="/dashboard/customers"
        className="text-xs text-slate-500 hover:text-[var(--jaddid-blue)]"
      >
        ← العودة للعملاء
      </Link>
      <h1 className="mb-6 mt-2 text-xl font-bold text-[var(--jaddid-navy)]">إضافة عميل جديد</h1>

      <div className="rounded-2xl border border-[var(--jaddid-border)] bg-white p-5">
        <CustomerForm organizationId={membership.organization_id} stores={stores} />
      </div>
    </main>
  );
}
