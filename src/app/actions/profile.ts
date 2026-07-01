"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateProfile(_prev: unknown, formData: FormData) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const display_name        = (formData.get("display_name")        as string).trim() || null;
  const title               = (formData.get("title")               as string).trim() || "Code Newbie";
  const bio                 = (formData.get("bio")                  as string).trim() || null;
  const location            = (formData.get("location")            as string).trim() || null;
  const website             = (formData.get("website")             as string).trim() || null;
  const github_url          = (formData.get("github_url")          as string).trim() || null;
  const availability_status = (formData.get("availability_status") as string) || "available";
  const tech_stack_raw      = (formData.get("tech_stack")          as string) || "";
  const tech_stack          = tech_stack_raw.split(",").map(t => t.trim()).filter(Boolean);

  if (!["available", "busy", "away"].includes(availability_status))
    return { error: "Invalid availability status." };

  const { error } = await supabase
    .from("profiles")
    .update({ display_name, title, bio, location, website, github_url, availability_status, tech_stack })
    .eq("id", user.id);

  if (error) return { error: error.message };

  // Get username for revalidation
  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single();

  revalidatePath(`/u/${profile?.username ?? ""}`);
  revalidatePath("/profile");

  return { success: true, username: profile?.username };
}
