import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Shell } from "@/components/shell";
import { Reading } from "@/components/reading";
import { configured, supabase } from "@/lib/supabase/server";
import { readPublication } from "@/lib/access";
import { textContent } from "@/lib/model";
export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (!configured())
    return { title: "Texto no disponible", robots: { index: false } };
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return {};
  const p = await readPublication(id);
  if (!p) return { robots: { index: false, follow: false } };
  return {
    title: p.title,
    description: textContent(p.content).slice(0, 160),
    robots: { index: p.is_public, follow: p.is_public },
    openGraph: {
      title: p.title,
      description: textContent(p.content).slice(0, 160),
      type: "article",
    },
  };
}
export default async function Page({ params }: Props) {
  if (!configured()) notFound();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const publication = await readPublication(id);
  if (!publication) notFound();
  const db = await supabase();
  const { data: author } = await db
    .from("profiles")
    .select("display_name,handle")
    .eq("id", publication.owner_id)
    .maybeSingle();
  return (
    <Shell>
      <Reading initial={[publication]} author={author ?? undefined} />
    </Shell>
  );
}
