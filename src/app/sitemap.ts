import type { MetadataRoute } from "next";
import { configured, supabase } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const entries: MetadataRoute.Sitemap = ["", "/wall", "/resources"].map(
    (path) => ({ url: base + path }),
  );
  if (configured()) {
    const db = await supabase();
    const { data, error } = await db
      .from("publications")
      .select("document_id,updated_at")
      .eq("is_public", true);
    if (error) throw error;
    for (const p of data ?? [])
      entries.push({
        url: `${base}/text/${p.document_id}`,
        lastModified: p.updated_at,
      });
  }
  return entries;
}
