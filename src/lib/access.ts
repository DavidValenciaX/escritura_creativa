import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { service, supabase } from "./supabase/server";
import type { Publication, Notebook } from "./model";
import { HttpError, check } from "./http";
export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
export async function ensureRecoverableLinks(ownerId: string) {
  const db = service();
  const { data, error } = await db
    .from("share_links")
    .select("id,token_hash")
    .eq("owner_id", ownerId)
    .is("token", null)
    .is("revoked_at", null);
  check(error);
  for (const link of data ?? []) {
    const token = randomBytes(32).toString("hex");
    const { error } = await db
      .from("share_links")
      .update({
        token,
        token_hash: hashToken(token),
        legacy_token_hash: link.token_hash,
      })
      .eq("id", link.id)
      .eq("owner_id", ownerId)
      .eq("token_hash", link.token_hash)
      .is("token", null)
      .is("revoked_at", null);
    check(error);
  }
}
export async function resolveLink(token: string) {
  const isShortCode = /^[A-Za-z0-9_-]{22}$/.test(token);
  if (!isShortCode && !/^[a-f0-9]{64}$/.test(token))
    throw new HttpError(404, "Enlace no disponible.");
  const db = service();
  const hash = hashToken(token);
  const { data: current, error } = await db
    .from("share_links")
    .select("*")
    .eq(isShortCode ? "short_code" : "token_hash", isShortCode ? token : hash)
    .is("revoked_at", null)
    .maybeSingle();
  check(error);
  let link = current;
  if (!link && !isShortCode) {
    const { data, error } = await db
      .from("share_links")
      .select("*")
      .eq("legacy_token_hash", hash)
      .is("revoked_at", null)
      .maybeSingle();
    check(error);
    link = data;
  }
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
