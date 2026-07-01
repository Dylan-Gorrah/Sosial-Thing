import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

// Rail's Profile link hits this route — redirect to the real profile URL
export default async function ProfileRedirectPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");
  redirect(`/u/${profile.username}`);
}
