import Link from "next/link";
import { Shell } from "@/components/shell";
import { Setup, SignInRequired } from "@/components/setup";
import { configured, session, supabase } from "@/lib/supabase/server";
import { enrich } from "@/lib/list-publications";
import { Publications } from "@/components/publications";
import type { Publication } from "@/lib/model";
export const metadata = {
  title: "Compartido conmigo",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export default async function Page() {
  if (!configured())
    return (
      <Shell active="/received">
        <Setup />
      </Shell>
    );
  const user = await session();
  if (!user)
    return (
      <Shell active="/received">
        <SignInRequired />
      </Shell>
    );
  const db = await supabase();
  const { data: grants, error } = await db
    .from("grants")
    .select("*")
    .eq("recipient_email", user.email!.toLowerCase());
  if (error) throw error;
  const books = (grants ?? [])
    .filter((g) => g.notebook_id)
    .map((g) => g.notebook_id);
  const docs = (grants ?? [])
    .filter((g) => g.document_id)
    .map((g) => g.document_id);
  const { data: notebooks, error: booksError } = await db
    .from("notebooks")
    .select("*")
    .in("id", books);
  if (booksError) throw booksError;
  const { data: publications, error: pubError } = await db
    .from("publications")
    .select("*")
    .in("document_id", docs)
    .order("published_at", { ascending: false });
  if (pubError) throw pubError;
  return (
    <Shell active="/received">
      <div className="page-heading">
        <div>
          <h1>Compartido conmigo</h1>
          <p>Cuadernos y textos a los que te han concedido acceso.</p>
        </div>
      </div>
      {notebooks?.map((n) => (
        <Link href={`/notebook/${n.id}`} key={n.id} className="notebook-bar">
          <div>
            <h3>{n.title}</h3>
            <p>{n.description || "Leer este cuaderno"}</p>
          </div>
          <span className="text-button">Abrir cuaderno →</span>
        </Link>
      ))}
      <Publications
        entries={await enrich((publications ?? []) as Publication[])}
        empty="Todavía no tienes textos compartidos"
      />
    </Shell>
  );
}
