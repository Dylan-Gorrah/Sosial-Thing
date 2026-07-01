import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import EditProfileForm from "@/components/profile/EditProfileForm";
import type { Profile } from "@/types";

export default async function SettingsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  return (
    <div className="h-full overflow-y-auto scroll" style={{ background: "var(--color-bg)" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "32px 24px 64px" }}>

        <h2
          className="font-semibold m-0 mb-1"
          style={{ fontSize: 20, color: "var(--color-text)", letterSpacing: "-.01em" }}
        >
          Edit Profile
        </h2>
        <p className="text-[13px] m-0 mb-8" style={{ color: "var(--color-text-3)" }}>
          Changes show up on your public profile immediately.
        </p>

        <EditProfileForm profile={profile as Profile} />
      </div>
    </div>
  );
}
