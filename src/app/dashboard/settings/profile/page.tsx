import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProfileForm from "./ProfileForm";
import ChangeEmailForm from "./ChangeEmailForm";

export default async function ProfileSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div className="space-y-6">
      <ProfileForm email={user.email ?? ""} initialFullName={profile?.full_name ?? ""} />
      <ChangeEmailForm currentEmail={user.email ?? ""} />
    </div>
  );
}
