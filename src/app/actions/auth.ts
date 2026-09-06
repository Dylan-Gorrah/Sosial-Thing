"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function login(_prev: unknown, formData: FormData) {
  const supabase = await createClient();

  const username = (formData.get("username") as string).trim().toLowerCase();
  const password = formData.get("password") as string;

  // Look up email by username — profiles are public read
  const { data: profile } = await supabase
    .from("profiles")
    .select("email")
    .eq("username", username)
    .single();

  if (!profile) return { error: "No account found with that username." };

  const { error } = await supabase.auth.signInWithPassword({
    email: profile.email,
    password,
  });

  if (error) return { error: "Wrong username or password." };

  // Return to where they were headed (e.g. an invite link), but only ever to a
  // relative in-app path — never an absolute URL, to avoid open-redirects.
  const next = (formData.get("next") as string | null) ?? "";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/feed";
  redirect(safeNext);
}

export async function register(_prev: unknown, formData: FormData) {
  const supabase = await createClient();

  const username = (formData.get("username") as string).trim().toLowerCase();
  const email    = formData.get("email")    as string;
  const password = formData.get("password") as string;

  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    return { error: "Username must be 3–20 chars, letters/numbers/underscores only." };
  }

  // Check the name is free BEFORE creating the auth user. Without this, signUp
  // succeeds, the handle_new_user trigger hits the unique index on
  // profiles.username, and the raw Postgres error is shown to the person:
  // 'duplicate key value violates unique constraint "profiles_username_key"'.
  // Profiles are public-read, so this lookup needs no privileges.
  const { data: taken } = await supabase
    .from("profiles")
    .select("username")
    .eq("username", username)
    .maybeSingle();

  if (taken) return { error: "That username is already taken — try another." };

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username } },
  });

  if (error) {
    // Belt and braces: two people can still claim the same name in the gap
    // between the check above and the insert. Catch the unique violation and
    // say something human instead of leaking table and column names.
    const raw = error.message ?? "";
    if (raw.includes("profiles_username_key") || raw.includes("duplicate key")) {
      return { error: "That username is already taken — try another." };
    }
    return { error: raw || "Could not create your account. Try again." };
  }

  return { success: true, email };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
