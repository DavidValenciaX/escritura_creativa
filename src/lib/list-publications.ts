import "server-only";
import { supabase } from "./supabase/server";
import type { Publication } from "./model";
import type { PublicEntry } from "@/components/publications";
export async function enrich(
  publications: Publication[],
  userId?: string,
): Promise<PublicEntry[]> {
  const db = await supabase();
  const ids = [...new Set(publications.map((p) => p.owner_id))];
  const { data: profiles, error } = await db
    .from("profiles")
    .select("id,handle,display_name")
    .in("id", ids);
  if (error) throw error;
  let favoriteIds = new Set<string>();
  if (userId) {
    const { data, error } = await db
      .from("favorites")
      .select("document_id")
      .eq("user_id", userId);
    if (error) throw error;
    favoriteIds = new Set(data?.map((f) => f.document_id));
  }
  return publications.map((p) => ({
    ...p,
    profile: profiles?.find((a) => a.id === p.owner_id),
    favorite: favoriteIds.has(p.document_id),
  }));
}
