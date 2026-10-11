import { notFound } from "next/navigation";
import { Shell } from "@/components/shell";
import { Reading } from "@/components/reading";
import { configured, supabase } from "@/lib/supabase/server";
import type { Publication } from "@/lib/model";
export const metadata = {
  title: "Cuaderno compartido",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!configured()) notFound();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = await supabase();
  const { data: notebook, error } = await db
    .from("notebooks")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !notebook) notFound();
  const { data, error: readError } = await db.rpc("read_notebook", {
    book: id,
  });
  if (readError) throw readError;
  return (
    <Shell>
      <Reading initial={(data ?? []) as Publication[]} notebook={notebook} />
    </Shell>
  );
}
