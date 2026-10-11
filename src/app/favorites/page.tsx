import { Shell } from "@/components/shell";
import { Setup, SignInRequired } from "@/components/setup";
import { configured, session, supabase } from "@/lib/supabase/server";
import { enrich } from "@/lib/list-publications";
import { Publications } from "@/components/publications";
import type { Publication } from "@/lib/model";
export const metadata = {
  title: "Mis favoritos",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export default async function Page() {
  if (!configured())
    return (
      <Shell active="/favorites">
        <Setup />
      </Shell>
    );
  const user = await session();
  if (!user)
    return (
      <Shell active="/favorites">
        <SignInRequired />
      </Shell>
    );
  const db = await supabase();
  const { data: ids, error: idsError } = await db
    .from("favorites")
    .select("document_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (idsError) throw idsError;
  const { data, error } = await db
    .from("publications")
    .select("*")
    .eq("is_public", true)
    .in(
      "document_id",
      (ids ?? []).map((f) => f.document_id),
    );
  if (error) throw error;
  return (
    <Shell active="/favorites">
      <div className="page-heading">
        <div>
          <p className="eyebrow">PALABRAS A LAS QUE VOLVER</p>
          <h1>Mis favoritos</h1>
          <p>Una pequeña colección de textos que te acompañan.</p>
        </div>
      </div>
      <Publications
        entries={await enrich((data ?? []) as Publication[], user.id)}
        canFavorite
        empty="Tu colección está por empezar"
      />
    </Shell>
  );
}
