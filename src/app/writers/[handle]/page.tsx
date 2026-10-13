import { notFound } from "next/navigation";
import { Shell } from "@/components/shell";
import { Publications } from "@/components/publications";
import { configured, session, supabase } from "@/lib/supabase/server";
import { enrich } from "@/lib/list-publications";
import type { Publication } from "@/lib/model";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  if (!configured()) notFound();
  const { handle } = await params;
  const db = await supabase();
  const { data: profile, error } = await db
    .from("profiles")
    .select("*")
    .eq("handle", handle)
    .maybeSingle();
  if (error || !profile) notFound();
  const { data, error: pubError } = await db
    .from("publications")
    .select("*")
    .eq("owner_id", profile.id)
    .eq("is_public", true)
    .order("published_at", { ascending: false });
  if (pubError) throw pubError;
  const user = await session();
  return (
    <Shell active="/wall">
      <section className="profile-banner">
        {profile.avatar_upload_id ? (
          <img src={`/api/avatar/${profile.avatar_upload_id}`} alt="" />
        ) : profile.avatar_resource_id ? (
          <img src={`/api/resource/${profile.avatar_resource_id}`} alt="" />
        ) : (
          <span className="avatar">
            {profile.display_name[0].toUpperCase()}
          </span>
        )}
        <div>
          <p className="eyebrow">@{profile.handle}</p>
          <h1>{profile.display_name}</h1>
          {profile.bio && <p>{profile.bio}</p>}
        </div>
      </section>
      <Publications
        entries={await enrich((data ?? []) as Publication[], user?.id)}
        canFavorite={!!user}
      />
    </Shell>
  );
}
