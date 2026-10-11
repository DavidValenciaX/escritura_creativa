import { notFound } from "next/navigation";
import { Shell } from "@/components/shell";
import { Moderation } from "@/components/moderation";
import { configured, supabase, service } from "@/lib/supabase/server";
export const metadata = {
  title: "Moderación",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export default async function Page() {
  if (!configured()) notFound();
  const db = await supabase();
  const { data: admin } = await db.rpc("is_admin");
  if (!admin) notFound();
  const { data, error } = await service()
    .from("reports")
    .select("*")
    .eq("status", "open")
    .order("created_at");
  if (error) throw error;
  const reports = await Promise.all(
    (data ?? []).map(async (report) => {
      const { data: target } = report.resource_id
        ? await service()
            .from("resources")
            .select("name")
            .eq("id", report.resource_id)
            .maybeSingle()
        : await service()
            .from("publications")
            .select("title")
            .eq("document_id", report.document_id)
            .maybeSingle();
      return {
        ...report,
        name: target
          ? "name" in target
            ? target.name
            : target.title
          : "Contenido retirado",
      };
    }),
  );
  return (
    <Shell>
      <Moderation initial={reports} />
    </Shell>
  );
}
