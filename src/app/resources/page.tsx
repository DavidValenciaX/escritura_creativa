import { Shell } from "@/components/shell";
import { configured, session, supabase } from "@/lib/supabase/server";
import { ResourceLibrary } from "@/components/resources";
import { builtins } from "@/lib/catalog";
import type { Resource } from "@/lib/model";
export const metadata = { title: "Biblioteca de recursos" };
export const dynamic = "force-dynamic";
export default async function Page() {
  let resources: Resource[] = builtins;
  const connected = configured();
  if (connected) {
    const db = await supabase();
    const { data, error } = await db
      .from("resources")
      .select("*")
      .eq("hidden", false)
      .order("created_at", { ascending: false });
    if (error)
      throw new Error(
        "No se pudo abrir la biblioteca. Comprueba las migraciones de Supabase.",
      );
    resources = data ?? [];
  }
  return (
    <Shell active="/resources">
      <ResourceLibrary
        initial={resources}
        connected={connected}
        userId={(await session())?.id ?? null}
      />
    </Shell>
  );
}
