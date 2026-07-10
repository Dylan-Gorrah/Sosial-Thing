import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ModQueueClient, { type ModReport } from "@/components/mod/ModQueueClient";

// The moderation queue. One page serves everyone who can act on reports:
// room owners see their rooms' reports, the site admin sees all of them.
// Regular users never see anything here — RLS already scopes reads, and we
// additionally filter to "reports you can act on" so your own filed reports
// don't show up as a queue.
export default async function ModPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Can this user moderate anything?
  const [{ data: profile }, { data: ownedRooms }] = await Promise.all([
    supabase.from("profiles").select("is_admin").eq("id", user.id).single(),
    supabase.from("rooms").select("id, name").eq("created_by", user.id),
  ]);

  const isAdmin      = !!profile?.is_admin;
  const ownedRoomIds = (ownedRooms ?? []).map(r => r.id);

  let reports: ModReport[] = [];
  if (isAdmin || ownedRoomIds.length > 0) {
    // reports has two FKs into profiles (reporter_id, resolved_by) — the
    // reporter embed must name its FK or PostgREST refuses the join.
    let q = supabase
      .from("reports")
      .select(`
        id, post_id, comment_id, room_id, reason, note, status, created_at,
        post:posts(id, title, user_id, removed_at, author:profiles(username)),
        comment:comments(id, content, post_id, user_id, author:profiles(username)),
        room:rooms(id, name),
        reporter:profiles!reports_reporter_id_fkey(username)
      `)
      .order("created_at", { ascending: false })
      .limit(100);

    if (!isAdmin) q = q.in("room_id", ownedRoomIds);

    const { data } = await q;
    reports = (data ?? []) as unknown as ModReport[];
  }

  return (
    <ModQueueClient
      reports={reports}
      canModerate={isAdmin || ownedRoomIds.length > 0}
    />
  );
}
