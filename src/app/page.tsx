import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Landing, { type LandingStats } from "@/components/landing/Landing";

export default async function RootPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) redirect("/feed");

  const { data } = await supabase.rpc("get_landing_stats");
  const stats: LandingStats = data ?? { devs: 0, posts: 0, comments: 0, clout: 0, verified: 0 };

  return <Landing stats={stats} />;
}
