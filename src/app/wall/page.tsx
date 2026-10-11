import { Shell } from "@/components/shell";
import { Setup } from "@/components/setup";
import { Publications } from "@/components/publications";
import { configured, session, supabase } from "@/lib/supabase/server";
import { enrich } from "@/lib/list-publications";
import type { Publication } from "@/lib/model";
export const metadata = { title: "Muro de escritores" };
export const dynamic = "force-dynamic";
export default async function Page() {
  if (!configured())
    return (
      <Shell active="/wall">
        <Setup title="Las palabras de otros, muy pronto" />
      </Shell>
    );
  const db = await supabase();
  const user = await session();
  const { data, error } = await db
    .from("publications")
    .select("*")
    .eq("is_public", true)
    .order("published_at", { ascending: false });
  if (error) throw error;
  return (
    <Shell active="/wall">
      <div className="page-heading">
        <div>
          <p className="eyebrow">UNA VENTANA A OTROS MUNDOS</p>
          <h1>Muro de escritores</h1>
          <p>Cartas, poemas e historias que alguien quiso compartir.</p>
        </div>
      </div>
      <Publications
        entries={await enrich((data ?? []) as Publication[], user?.id)}
        canFavorite={!!user}
      />
    </Shell>
  );
}
