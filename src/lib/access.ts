import "server-only";
import { createHash } from "node:crypto";
import { service, supabase } from "./supabase/server";
import type { Publication, Notebook } from "./model";
import { HttpError, check } from "./http";
export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
export async function resolveLink(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token))
    throw new HttpError(404, "Enlace no disponible.");
  const db = service();
  const { data: link, error } = await db
    .from("share_links")
    .select("*")
    .eq("token_hash", hashToken(token))
    .is("revoked_at", null)
    .maybeSingle();
  check(error);
  if (!link) throw new HttpError(404, "El enlace no existe o fue revocado.");
  let notebook: Notebook | null = null;
  let query = db.from("publications").select("*");
  if (link.document_id) query = query.eq("document_id", link.document_id);
  else {
    const { data: book } = await db
      .from("notebooks")
      .select("*")
      .eq("id", link.notebook_id)
      .single();
    notebook = book;
    const { data: docs, error: docError } = await db
      .from("documents")
      .select("id,position")
      .eq("notebook_id", link.notebook_id)
      .order("position");
    check(docError);
    query = query.in(
      "document_id",
      (docs ?? []).map((d) => d.id),
    );
    const { data, error } = await query;
    check(error);
    const order = new Map((docs ?? []).map((d, i) => [d.id, i]));
    return {
      link,
      notebook,
      publications: ((data as Publication[]) ?? []).sort(
        (a, b) =>
          (order.get(a.document_id) ?? 0) - (order.get(b.document_id) ?? 0),
      ),
    };
  }
  const { data, error: readError } = await query;
  check(readError);
  return { link, notebook, publications: (data ?? []) as Publication[] };
}
export async function readPublication(id: string, token?: string) {
  if (token) {
    const resolved = await resolveLink(token);
    return resolved.publications.find((p) => p.document_id === id) ?? null;
  }
  const db = await supabase();
  const { data, error } = await db
    .from("publications")
    .select("*")
    .eq("document_id", id)
    .maybeSingle();
  check(error);
  return data as Publication | null;
}
