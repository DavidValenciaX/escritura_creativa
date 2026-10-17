import { NextResponse } from "next/server";
import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import {
  authenticated,
  check,
  failure,
  HttpError,
  sameOrigin,
} from "@/lib/http";
import { configured, service, supabase } from "@/lib/supabase/server";
import {
  ensureRecoverableLinks,
  hashToken,
  readPublication,
  resolveLink,
} from "@/lib/access";
import {
  defaultAppearance,
  draftSchema,
  emptyContent,
  imageIds,
  referencesResource,
  type Draft,
  type Document,
} from "@/lib/model";
import { prepareUpload, prepareAvatar } from "@/lib/uploads";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };
async function boundedBody(request: Request, limit: number) {
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "Faltan los datos.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      await reader.cancel();
      throw new HttpError(413, "El archivo o texto es demasiado grande.");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
async function json(request: Request) {
  const body = await boundedBody(request, 600000);
  try {
    return JSON.parse(body.toString("utf8"));
  } catch {
    throw new HttpError(400, "Datos inválidos.");
  }
}
async function ownedDocument(id: string) {
  const { db, user } = await authenticated();
  const { data, error } = await db
    .from("documents")
    .select("*")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();
  check(error);
  if (!data) throw new HttpError(404, "Texto no disponible.");
  return { db, user, document: data as Document };
}
async function validateReferences(draft: Draft, doc: Document) {
  const admin = service();
  const mediaIds = imageIds(draft.content, "assetId");
  if (mediaIds.length) {
    const { data, error } = await admin
      .from("media")
      .select("id")
      .eq("document_id", doc.id)
      .eq("owner_id", doc.owner_id)
      .in("id", mediaIds);
    check(error);
    if (data?.length !== mediaIds.length)
      throw new HttpError(400, "Una imagen no pertenece a este texto.");
  }
  const pairs = [
    { id: draft.appearance.paper, kind: "paper" },
    { id: draft.appearance.titleFont, kind: "font" },
    { id: draft.appearance.bodyFont, kind: "font" },
    { id: draft.appearance.signatureFont, kind: "font" },
    ...imageIds(draft.content, "resourceId").map((id) => ({
      id,
      kind: "image",
    })),
  ].filter((p) => z.uuid().safeParse(p.id).success);
  if (pairs.length) {
    const { data, error } = await admin
      .from("resources")
      .select("*")
      .in(
        "id",
        pairs.map((p) => p.id),
      );
    check(error);
    if (
      pairs.some(
        (p) =>
          !data?.some(
            (r) =>
              r.id === p.id &&
              r.kind === p.kind &&
              (!r.hidden || referencesResource(doc, p.id)),
          ),
      )
    )
      throw new HttpError(400, "Un recurso ya no está disponible.");
  }
}
async function canAccessResource(id: string, token: string | null) {
  const db = await supabase();
  const { data: resource, error } = await service()
    .from("resources")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  check(error);
  if (!resource) throw new HttpError(404, "Recurso no disponible.");
  if (!resource.hidden) return resource;
  const {
    data: { user },
  } = await db.auth.getUser();
  const { data: admin } = await db.rpc("is_admin");
  if (user?.id === resource.owner_id || admin) return resource;
  const { data: pubs } = await db
    .from("publications")
    .select("content,appearance");
  if (pubs?.some((p) => referencesResource(p, id))) return resource;
  if (user) {
    const { data: docs } = await db
      .from("documents")
      .select("content,appearance");
    if (docs?.some((d) => referencesResource(d, id))) return resource;
  }
  if (
    token &&
    (await resolveLink(token)).publications.some((p) =>
      referencesResource(p, id),
    )
  )
    return resource;
  throw new HttpError(404, "Recurso no disponible.");
}
export async function GET(request: Request, context: Context) {
  try {
    if (!configured())
      throw new HttpError(
        503,
        "Supabase aún no está configurado. Consulta el README.",
      );
    const { path } = await context.params;
    const url = new URL(request.url);
    const token = url.searchParams.get("token");
    if (path[0] === "avatar" && path[1]) {
      const id = z.uuid().parse(path[1]);
      const admin = service();
      const { data: avatar, error } = await admin
        .from("avatars")
        .select("owner_id,storage_path")
        .eq("id", id)
        .maybeSingle();
      check(error);
      if (!avatar) throw new HttpError(404, "Avatar no disponible.");
      const db = await supabase();
      const { data: profile, error: profileError } = await db
        .from("profiles")
        .select("id")
        .eq("avatar_upload_id", id)
        .maybeSingle();
      check(profileError);
      if (!profile) {
        const {
          data: { user },
        } = await db.auth.getUser();
        if (user?.id !== avatar.owner_id)
          throw new HttpError(404, "Avatar no disponible.");
      }
      const { data: file, error: downloadError } = await admin.storage
        .from("avatars")
        .download(avatar.storage_path);
      check(downloadError);
      if (!file) throw new HttpError(404, "Avatar no disponible.");
      return new NextResponse(await file.arrayBuffer(), {
        headers: {
          "Content-Type": "image/webp",
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    if (path[0] === "studio") {
      const { db, user } = await authenticated();
      await ensureRecoverableLinks(user.id);
      const queries = await Promise.all([
        db
          .from("documents")
          .select("*")
          .eq("owner_id", user.id)
          .order("updated_at", { ascending: false }),
        db
          .from("notebooks")
          .select("*")
          .eq("owner_id", user.id)
          .order("created_at"),
        db
          .from("publications")
          .select("document_id,is_public,updated_at")
          .eq("owner_id", user.id),
        db.from("grants").select("*").eq("owner_id", user.id),
        db
          .from("share_links")
          .select("id,document_id,notebook_id,created_at,revoked_at,short_code")
          .eq("owner_id", user.id),
        db
          .from("resources")
          .select("*")
          .eq("hidden", false)
          .order("created_at", { ascending: false }),
      ]);
      queries.forEach((q) => check(q.error));
      return NextResponse.json(
        {
          documents: queries[0].data,
          notebooks: queries[1].data,
          publications: queries[2].data,
          grants: queries[3].data,
          links: queries[4].data?.map(({ short_code, ...link }) => ({
            ...link,
            url:
              short_code && !link.revoked_at
                ? `${(process.env.NEXT_PUBLIC_SITE_URL ?? url.origin).replace(/\/$/, "")}/s/${short_code}`
                : null,
          })),
          resources: queries[5].data,
        },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    }
    if (path[0] === "link" && path[1]) {
      const resolved = await resolveLink(path[1]);
      return NextResponse.json(
        { publications: resolved.publications },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    }
    if (path[0] === "notebook" && path[1]) {
      const { db } = await authenticated();
      const id = z.uuid().parse(path[1]);
      const { data: book, error } = await db
        .from("notebooks")
        .select("id")
        .eq("id", id)
        .maybeSingle();
      check(error);
      if (!book) throw new HttpError(404, "Cuaderno no disponible.");
      const { data, error: readError } = await db.rpc("read_notebook", {
        book: id,
      });
      check(readError);
      return NextResponse.json(
        { publications: data },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    }
    if (path[0] === "read" && path[1]) {
      const id = z.uuid().parse(path[1]);
      const pub = await readPublication(id, token ?? undefined);
      if (!pub) throw new HttpError(404, "Texto no disponible.");
      return NextResponse.json(pub, {
        headers: { "Cache-Control": "private, no-store" },
      });
    }
    if (path[0] === "media" && path[1]) {
      const id = z.uuid().parse(path[1]);
      const admin = service();
      const { data: media, error } = await admin
        .from("media")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      check(error);
      if (!media) throw new HttpError(404, "Imagen no disponible.");
      const db = await supabase();
      const {
        data: { user },
      } = await db.auth.getUser();
      if (user?.id !== media.owner_id) {
        const publication = await readPublication(
          media.document_id,
          token ?? undefined,
        );
        if (
          !publication ||
          !imageIds(publication.content, "assetId").includes(id)
        )
          throw new HttpError(404, "Imagen no disponible.");
      }
      const { data, error: downloadError } = await admin.storage
        .from("personal")
        .download(media.storage_path);
      check(downloadError);
      if (!data) throw new HttpError(404, "Imagen no disponible.");
      return new Response(await data.arrayBuffer(), {
        headers: {
          "Content-Type": media.mime,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    if (path[0] === "resource" && path[1]) {
      const resource = await canAccessResource(z.uuid().parse(path[1]), token);
      if (!resource.storage_path)
        throw new HttpError(
          404,
          "Este recurso está incluido en la aplicación.",
        );
      const { data, error } = await service()
        .storage.from("community")
        .download(resource.storage_path);
      check(error);
      if (!data) throw new HttpError(404, "Archivo no disponible.");
      return new Response(await data.arrayBuffer(), {
        headers: {
          "Content-Type": resource.kind === "font" ? "font/woff2" : data.type,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    throw new HttpError(404, "Ruta no disponible.");
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request, context: Context) {
  try {
    sameOrigin(request);
    if (!configured())
      throw new HttpError(503, "Supabase aún no está configurado.");
    const { path } = await context.params;
    const { db, user } = await authenticated();
    if (path[0] === "upload") {
      const isAvatar = path[1] === "avatar";
      const bytes = await boundedBody(
        request,
        isAvatar ? 4 * 1024 * 1024 + 65536 : 11 * 1024 * 1024,
      );
      const form = await new Request(request.url, {
        method: "POST",
        headers: { "content-type": request.headers.get("content-type") ?? "" },
        body: bytes,
      }).formData();
      const file = form.get("file");
      if (!(file instanceof File))
        throw new HttpError(400, "Elige un archivo.");
      const isResource = !isAvatar && form.get("mode") === "resource";
      const kind = isResource
        ? z.enum(["paper", "font", "image"]).parse(form.get("kind"))
        : "image";
      const input = new Uint8Array(await file.arrayBuffer());
      const verified = isAvatar
        ? await prepareAvatar(input, file.type)
        : await prepareUpload(
            input,
            kind === "font" ? "font" : "image",
            file.type,
          );
      const admin = service();
      const table = isAvatar ? "avatars" : isResource ? "resources" : "media";
      const { count, error: countError } = await admin
        .from(table)
        .select("id", { count: "exact", head: true })
        .eq("owner_id", user.id)
        .gte("created_at", new Date(Date.now() - 3600000).toISOString());
      check(countError);
      if ((count ?? 0) >= 30)
        throw new HttpError(
          429,
          "Has alcanzado el límite de 30 cargas por hora.",
        );
      let resourceValues: Record<string, unknown> = {};
      let documentId = "";
      if (isResource) {
        resourceValues = z
          .object({
            name: z.string().min(1).max(120),
            author: z.string().trim().max(160),
            source: z.string().trim().max(500),
            license: z.string().min(1).max(120),
            description: z.string().max(1000),
            tags: z.array(z.string().max(30)).max(8),
          })
          .superRefine((value, ctx) => {
            if (value.license === "CC0") return;
            for (const field of ["author", "source"] as const) {
              if (!value[field])
                ctx.addIssue({
                  code: "custom",
                  path: [field],
                  message:
                    field === "author"
                      ? "Indica la autoría para esta licencia."
                      : "Indica la procedencia para esta licencia.",
                });
            }
          })
          .parse({
            name: form.get("name"),
            author: form.get("author") ?? "",
            source: form.get("source") ?? "",
            license: form.get("license"),
            description: form.get("description") ?? "",
            tags: String(form.get("tags") ?? "")
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
          });
        if (form.get("permission") !== "yes")
          throw new HttpError(400, "Confirma el permiso de reutilización.");
      } else if (!isAvatar) {
        documentId = z.uuid().parse(form.get("documentId"));
        await ownedDocument(documentId);
      }
      const id = randomUUID();
      const storagePath = `${user.id}/${id}.${verified.extension}`;
      const bucket = isAvatar
        ? "avatars"
        : isResource
          ? "community"
          : "personal";
      const { error: uploadError } = await admin.storage
        .from(bucket)
        .upload(storagePath, verified.bytes, {
          contentType: verified.mime,
          upsert: false,
        });
      check(uploadError);
      const { error } = await admin.from(table).insert(
        isAvatar
          ? { id, owner_id: user.id, storage_path: storagePath }
          : isResource
            ? {
                ...resourceValues,
                id,
                owner_id: user.id,
                kind,
                storage_path: storagePath,
              }
            : {
                id,
                owner_id: user.id,
                document_id: documentId,
                storage_path: storagePath,
                mime: verified.mime,
              },
      );
      if (error) {
        await admin.storage.from(bucket).remove([storagePath]);
        check(error);
      }
      return NextResponse.json({
        id,
        url: `/api/${isAvatar ? "avatar" : isResource ? "resource" : "media"}/${id}`,
        ...(isAvatar
          ? {
              originalBytes: input.length,
              optimizedBytes: verified.bytes.length,
            }
          : {}),
      });
    }
    const body = await json(request);
    if (path[0] === "documents") {
      if (body.action === "create") {
        const notebook = z
          .uuid()
          .nullable()
          .parse(body.notebook_id ?? null);
        const { data, error } = await db
          .from("documents")
          .insert({
            owner_id: user.id,
            notebook_id: notebook,
            appearance: defaultAppearance,
            content: emptyContent,
          })
          .select()
          .single();
        check(error);
        return NextResponse.json(data);
      }
      const id = z.uuid().parse(body.id);
      const { document } = await ownedDocument(id);
      if (body.action === "move") {
        const notebook = z.uuid().nullable().parse(body.notebook_id);
        const expected = z.number().int().positive().parse(body.revision);
        if (notebook) {
          const { data: owns, error } = await db.rpc("owns_target", {
            doc: null,
            book: notebook,
          });
          check(error);
          if (!owns)
            throw new HttpError(403, "El cuaderno no pertenece a tu cuenta.");
        }
        const { data, error } = await db
          .from("documents")
          .update({ notebook_id: notebook, revision: expected + 1 })
          .eq("id", id)
          .eq("owner_id", user.id)
          .eq("revision", expected)
          .select("*")
          .maybeSingle();
        check(error);
        if (!data)
          throw new HttpError(
            409,
            "El escrito cambió en otra pestaña. Actualiza el estudio antes de moverlo.",
          );
        return NextResponse.json(data);
      }
      if (body.action === "save") {
        const draft = draftSchema.parse(body.draft);
        await validateReferences(draft, document);
        const expected = z.number().int().positive().parse(body.revision);
        const { data, error } = await db
          .rpc("save_document", {
            doc: id,
            expected_revision: expected,
            payload: draft,
          })
          .single();
        if (error?.code === "40001")
          throw new HttpError(
            409,
            "Hay una versión más reciente. Tu borrador local se conserva.",
          );
        check(error);
        return NextResponse.json(data);
      }
      if (body.action === "duplicate") {
        const { data, error } = await db
          .from("documents")
          .insert({
            owner_id: user.id,
            title: `${document.title.slice(0, 190)} (copia)`,
            written_on: document.written_on,
            content: document.content,
            appearance: document.appearance,
            signature: document.signature,
            notebook_id: document.notebook_id,
            position: document.position,
          })
          .select()
          .single();
        check(error);
        // Personal images must have their own records so the copied letter survives deletion of the source.
        const admin = service();
        const ids = imageIds(document.content, "assetId");
        let content = JSON.stringify(document.content);
        const copied: string[] = [];
        try {
          for (const sourceId of ids) {
            const { data: media, error: mediaError } = await admin
              .from("media")
              .select("*")
              .eq("id", sourceId)
              .eq("document_id", id)
              .single();
            check(mediaError);
            const newId = randomUUID();
            const newPath = `${user.id}/${newId}.${media.storage_path.split(".").pop()}`;
            const { error: copyError } = await admin.storage
              .from("personal")
              .copy(media.storage_path, newPath);
            check(copyError);
            copied.push(newPath);
            const { error: insertError } = await admin.from("media").insert({
              id: newId,
              owner_id: user.id,
              document_id: data.id,
              storage_path: newPath,
              mime: media.mime,
            });
            check(insertError);
            content = content.replaceAll(sourceId, newId);
          }
          const { data: updated, error: saveError } = await db
            .from("documents")
            .update({ content: JSON.parse(content) })
            .eq("id", data.id)
            .select()
            .single();
          check(saveError);
          return NextResponse.json(updated);
        } catch (error) {
          await db.from("documents").delete().eq("id", data.id);
          if (copied.length)
            await admin.storage.from("personal").remove(copied);
          throw error;
        }
      }
      if (body.action === "delete") {
        const admin = service();
        const { data: media } = await admin
          .from("media")
          .select("storage_path")
          .eq("document_id", id);
        const { error } = await db.from("documents").delete().eq("id", id);
        check(error);
        if (media?.length) {
          const { error: cleanupError } = await admin.storage
            .from("personal")
            .remove(media.map((m) => m.storage_path));
          check(cleanupError);
        }
        return NextResponse.json({ ok: true });
      }
    }
    if (path[0] === "notebooks") {
      if (body.action === "create") {
        const values = z
          .object({
            title: z.string().min(1).max(160),
            description: z.string().max(1000),
          })
          .parse(body);
        const { data, error } = await db
          .from("notebooks")
          .insert({ ...values, owner_id: user.id })
          .select()
          .single();
        check(error);
        return NextResponse.json(data);
      }
      const id = z.uuid().parse(body.id);
      const { data: book, error: bookError } = await db
        .from("notebooks")
        .select("id")
        .eq("id", id)
        .eq("owner_id", user.id)
        .maybeSingle();
      check(bookError);
      if (!book) throw new HttpError(404, "Cuaderno no disponible.");
      if (body.action === "delete") {
        const { error } = await db.from("notebooks").delete().eq("id", id);
        check(error);
        return NextResponse.json({ ok: true });
      }
      if (body.action === "update") {
        const values = z
          .object({
            title: z.string().min(1).max(160),
            description: z.string().max(1000),
          })
          .parse(body);
        const { error } = await db
          .from("notebooks")
          .update(values)
          .eq("id", id);
        check(error);
        return NextResponse.json({ ok: true });
      }
      if (body.action === "order") {
        const ids = z.array(z.uuid()).max(1000).parse(body.ids);
        const { error } = await db.rpc("reorder_notebook", {
          book: id,
          ordered_ids: ids,
        });
        check(error);
        return NextResponse.json({ ok: true });
      }
    }
    if (path[0] === "publish") {
      const id = z.uuid().parse(body.id);
      const { document } = await ownedDocument(id);
      if (body.action === "unpublish") {
        const { error } = await db
          .from("publications")
          .delete()
          .eq("document_id", id);
        check(error);
        return NextResponse.json({ ok: true });
      }
      const draft = draftSchema.parse(document);
      await validateReferences(draft, document);
      const { data, error } = await db
        .rpc("publish_document", {
          doc: id,
          expected_revision: z.number().int().positive().parse(body.revision),
          make_public: z.boolean().parse(body.is_public),
        })
        .single();
      if (error?.code === "40001")
        throw new HttpError(
          409,
          "El borrador cambió. Recarga antes de publicar.",
        );
      check(error);
      return NextResponse.json(data);
    }
    if (path[0] === "sharing") {
      const target = z
        .object({
          document_id: z.uuid().nullable(),
          notebook_id: z.uuid().nullable(),
        })
        .refine((v) => !!v.document_id !== !!v.notebook_id)
        .parse({
          document_id: body.document_id ?? null,
          notebook_id: body.notebook_id ?? null,
        });
      const { data: owns, error } = await db.rpc("owns_target", {
        doc: target.document_id,
        book: target.notebook_id,
      });
      check(error);
      if (!owns)
        throw new HttpError(403, "No puedes compartir este contenido.");
      if (body.action === "grant") {
        const email = z
          .email()
          .max(254)
          .parse(String(body.email).trim().toLowerCase());
        const { error } = await db
          .from("grants")
          .insert({ ...target, owner_id: user.id, recipient_email: email });
        if (error?.code === "23505")
          throw new HttpError(400, "Ese correo ya tiene acceso.");
        check(error);
        return NextResponse.json({ ok: true });
      }
      if (body.action === "revokeGrant") {
        const { error } = await db
          .from("grants")
          .delete()
          .eq("id", z.uuid().parse(body.id))
          .eq("owner_id", user.id);
        check(error);
        return NextResponse.json({ ok: true });
      }
      if (body.action === "link") {
        const token = randomBytes(32).toString("hex");
        const { data, error } = await service()
          .from("share_links")
          .insert({
            ...target,
            owner_id: user.id,
            token_hash: hashToken(token),
            token,
          })
          .select("id,short_code")
          .single();
        check(error);
        return NextResponse.json({
          id: data!.id,
          url: `${(process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin).replace(/\/$/, "")}/s/${data!.short_code}`,
        });
      }
      if (body.action === "revokeLink") {
        const { error } = await service()
          .from("share_links")
          .update({ revoked_at: new Date().toISOString() })
          .eq("id", z.uuid().parse(body.id))
          .eq("owner_id", user.id);
        check(error);
        return NextResponse.json({ ok: true });
      }
    }
    if (path[0] === "favorites") {
      const id = z.uuid().parse(body.id);
      const { error } = body.active
        ? await db
            .from("favorites")
            .insert({ user_id: user.id, document_id: id })
        : await db
            .from("favorites")
            .delete()
            .eq("user_id", user.id)
            .eq("document_id", id);
      check(error);
      return NextResponse.json({ ok: true });
    }
    if (path[0] === "reports") {
      const values = z
        .object({
          reason: z.string().min(5).max(1000),
          document_id: z.uuid().nullable(),
          resource_id: z.uuid().nullable(),
        })
        .refine((v) => !!v.document_id !== !!v.resource_id)
        .parse(body);
      if (
        values.document_id &&
        !(await readPublication(values.document_id, body.token))
      )
        throw new HttpError(404, "Texto no disponible.");
      if (values.resource_id) await canAccessResource(values.resource_id, null);
      const admin = service();
      const { count, error: countError } = await admin
        .from("reports")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", new Date(Date.now() - 3600000).toISOString());
      check(countError);
      if ((count ?? 0) >= 10)
        throw new HttpError(429, "Límite de reportes alcanzado.");
      const { error } = await admin
        .from("reports")
        .insert({ ...values, user_id: user.id });
      check(error);
      return NextResponse.json({ ok: true });
    }
    if (path[0] === "moderate") {
      const { data: admin, error } = await db.rpc("is_admin");
      check(error);
      if (!admin)
        throw new HttpError(403, "Se requiere acceso de administrador.");
      const id = z.uuid().parse(body.id);
      const adminDb = service();
      if (body.action === "hideResource") {
        const { error } = await adminDb
          .from("resources")
          .update({ hidden: true })
          .eq("id", id);
        check(error);
      } else if (body.action === "hideText") {
        const { error: blockError } = await adminDb
          .from("blocked_publications")
          .upsert({ document_id: id, moderator_id: user.id });
        check(blockError);
        const { error } = await adminDb
          .from("publications")
          .update({ is_public: false, updated_at: new Date().toISOString() })
          .eq("document_id", id);
        check(error);
      } else if (body.action === "resolve") {
        const { error } = await db
          .from("reports")
          .update({ status: "resolved" })
          .eq("id", id);
        check(error);
      } else throw new HttpError(400, "Acción inválida.");
      return NextResponse.json({ ok: true });
    }
    if (path[0] === "profile") {
      const profile = z
        .object({
          display_name: z.string().min(1).max(100),
          handle: z.string().regex(/^[a-z0-9_-]{3,40}$/),
          bio: z.string().max(1000),
          avatar_resource_id: z.uuid().nullable(),
          avatar_upload_id: z.uuid().nullable().default(null),
        })
        .parse(body);
      if (profile.avatar_upload_id) {
        if (profile.avatar_resource_id)
          throw new HttpError(400, "Elige un solo avatar.");
        const { data: avatar, error } = await db
          .from("avatars")
          .select("id")
          .eq("id", profile.avatar_upload_id)
          .eq("owner_id", user.id)
          .maybeSingle();
        check(error);
        if (!avatar)
          throw new HttpError(400, "El avatar debe pertenecer a tu cuenta.");
      }
      if (profile.avatar_resource_id) {
        const resource = await canAccessResource(
          profile.avatar_resource_id,
          null,
        );
        if (resource.kind !== "image")
          throw new HttpError(
            400,
            "El avatar debe ser una imagen comunitaria.",
          );
      }
      const { error } = await db
        .from("profiles")
        .update(profile)
        .eq("id", user.id);
      if (error?.code === "23505")
        throw new HttpError(
          400,
          "Ese nombre de usuario ya está en uso. Elige otro.",
        );
      check(error);
      return NextResponse.json({ ok: true });
    }
    throw new HttpError(400, "Acción no disponible.");
  } catch (error) {
    return failure(error);
  }
}
export async function DELETE(request: Request, context: Context) {
  try {
    sameOrigin(request);
    if (!configured())
      throw new HttpError(503, "Supabase aún no está configurado.");
    const { path } = await context.params;
    const { user } = await authenticated();
    if (path.length !== 2 || path[0] !== "resource")
      throw new HttpError(404, "Ruta no disponible.");
    const id = z.uuid().parse(path[1]);
    // Keep existing document/publication references working when a contribution
    // is removed from the catalogue. Community writes remain server-only.
    const { data, error } = await service()
      .from("resources")
      .update({ hidden: true })
      .eq("id", id)
      .eq("owner_id", user.id)
      .is("builtin_key", null)
      .select("id")
      .maybeSingle();
    check(error);
    if (!data)
      throw new HttpError(
        404,
        "Recurso no disponible o no aportado por tu cuenta.",
      );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
