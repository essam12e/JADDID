import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import OnboardingWizard from "./OnboardingWizard";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id, organizations(name)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  let store: {
    id: string;
    name: string;
    url: string | null;
    onboarding_step: number;
  } | null = null;

  if (membership) {
    const { data } = await supabase
      .from("stores")
      .select("id, name, url, onboarding_step")
      .eq("organization_id", membership.organization_id)
      .limit(1)
      .maybeSingle();
    store = data;
  }

  if (store && store.onboarding_step >= 6) {
    redirect("/dashboard");
  }

  return (
    <OnboardingWizard
      initialOrgId={membership?.organization_id ?? null}
      initialStore={store}
    />
  );
}
