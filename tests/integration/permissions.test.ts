import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
const url = process.env.INTEGRATION_SUPABASE_URL;
const anonKey = process.env.INTEGRATION_SUPABASE_ANON_KEY;
const serviceKey = process.env.INTEGRATION_SUPABASE_SERVICE_ROLE_KEY;
const ready = !!(url && anonKey && serviceKey);
describe.skipIf(!ready)(
  "real Supabase isolation (dedicated test project)",
  () => {
    let admin: SupabaseClient;
    let owner: SupabaseClient;
    let reader: SupabaseClient;
    let stranger: SupabaseClient;
    let anonymous: SupabaseClient;
    const users: string[] = [];
    const prefix = randomUUID().slice(0, 8);
    let ownerId: string;
    let readerEmail: string;
    let notebookId: string;
    let documentId: string;
    const draft = {
      title: "Privado",
      written_on: "2026-10-11",
      content: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Contenido publicado" }],
          },
        ],
      },
      appearance: {
        paper: "cream",
        titleFont: "caveat",
        bodyFont: "lora",
        fontSize: 18,
        lineHeight: 1.8,
        ink: "#34312d",
      },
      signature: "",
      notebook_id: null,
      position: 0,
    };
    beforeAll(async () => {
      admin = createClient(url!, serviceKey!, {
        auth: { persistSession: false },
      });
      anonymous = createClient(url!, anonKey!, {
        auth: { persistSession: false },
      });
      async function account(role: string) {
        const email = `ec-${prefix}-${role}@example.com`;
        const password = randomUUID() + "Aa1!";
        const { data, error } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });
        if (error || !data.user) throw error ?? new Error("No user");
        users.push(data.user.id);
        const client = createClient(url!, anonKey!, {
          auth: { persistSession: false },
        });
        const login = await client.auth.signInWithPassword({ email, password });
        if (login.error) throw login.error;
        return { client, id: data.user.id, email };
      }
      const a = await account("owner");
      owner = a.client;
      ownerId = a.id;
      const b = await account("reader");
      reader = b.client;
      readerEmail = b.email;
      stranger = (await account("stranger")).client;
      const book = await owner
        .from("notebooks")
        .insert({ owner_id: ownerId, title: "Bitácora" })
        .select()
        .single();
      if (book.error) throw book.error;
      notebookId = book.data.id;
      const doc = await owner
        .from("documents")
        .insert({ ...draft, owner_id: ownerId, notebook_id: notebookId })
        .select()
        .single();
      if (doc.error) throw doc.error;
      documentId = doc.data.id;
    });
    afterAll(async () => {
      for (const id of users) {
        const { error } = await admin.auth.admin.deleteUser(id);
        if (error) throw error;
      }
    });
    it("keeps drafts inaccessible to anonymous and unrelated accounts", async () => {
      for (const client of [anonymous, reader, stranger]) {
        const { data, error } = await client
          .from("documents")
          .select("*")
          .eq("id", documentId);
        expect(error).toBeNull();
        expect(data).toEqual([]);
      }
      const { error } = await stranger
        .from("documents")
        .update({ title: "Atacado" })
        .eq("id", documentId);
      expect(error).toBeNull();
      const { data } = await owner
        .from("documents")
        .select("title")
        .eq("id", documentId)
        .single();
      expect(data?.title).toBe("Privado");
    });
    it("shares published snapshots through notebook grants without leaking drafts", async () => {
      const pub = await owner.rpc("publish_document", {
        doc: documentId,
        expected_revision: 1,
        make_public: false,
      });
      expect(pub.error).toBeNull();
      const grant = await owner.from("grants").insert({
        owner_id: ownerId,
        notebook_id: notebookId,
        recipient_email: readerEmail,
      });
      expect(grant.error).toBeNull();
      const { data, error } = await reader.rpc("read_notebook", {
        book: notebookId,
      });
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      const updated = await owner.rpc("save_document", {
        doc: documentId,
        expected_revision: 1,
        payload: { ...draft, notebook_id: notebookId, title: "Borrador nuevo" },
      });
      expect(updated.error).toBeNull();
      const publication = await reader
        .from("publications")
        .select("title")
        .eq("document_id", documentId)
        .single();
      expect(publication.data?.title).toBe("Privado");
      const other = await stranger
        .from("publications")
        .select("*")
        .eq("document_id", documentId);
      expect(other.data).toEqual([]);
    });
    it("rejects stale revisions and grants forged by another user", async () => {
      const stale = await owner.rpc("save_document", {
        doc: documentId,
        expected_revision: 1,
        payload: { ...draft, notebook_id: notebookId },
      });
      expect(stale.error?.code).toBe("40001");
      const forged = await stranger.from("grants").insert({
        owner_id: users[2],
        document_id: documentId,
        recipient_email: readerEmail,
      });
      expect(forged.error).not.toBeNull();
    });
    it("revokes recipients and enforces private bucket isolation", async () => {
      const { error } = await owner
        .from("grants")
        .delete()
        .eq("notebook_id", notebookId);
      expect(error).toBeNull();
      const read = await reader
        .from("publications")
        .select("*")
        .eq("document_id", documentId);
      expect(read.data).toEqual([]);
      const upload = await reader.storage
        .from("personal")
        .upload(`${users[1]}/forbidden.txt`, "private");
      expect(upload.error).not.toBeNull();
    });
    it("limits private avatar metadata and assignments to the owning account", async () => {
      const id = randomUUID();
      const inserted = await admin
        .from("avatars")
        .insert({
          id,
          owner_id: users[0],
          storage_path: `${users[0]}/${id}.webp`,
        });
      expect(inserted.error).toBeNull();
      expect(
        (await anonymous.from("avatars").select("id").eq("id", id)).data,
      ).toEqual([]);
      expect(
        (await stranger.from("avatars").select("id").eq("id", id)).data,
      ).toEqual([]);
      const forged = await stranger
        .from("profiles")
        .update({ avatar_upload_id: id })
        .eq("id", users[2]);
      expect(forged.error).not.toBeNull();
      const updated = await owner
        .from("profiles")
        .update({ avatar_upload_id: id })
        .eq("id", users[0]);
      expect(updated.error).toBeNull();
      const bucket = await admin.storage.getBucket("avatars");
      expect(bucket.error).toBeNull();
      expect(bucket.data?.public).toBe(false);
    });
    it("public visibility can be removed without exposing drafts", async () => {
      const published = await owner.rpc("publish_document", {
        doc: documentId,
        expected_revision: 2,
        make_public: true,
      });
      expect(published.error).toBeNull();
      expect(
        (
          await anonymous
            .from("publications")
            .select("*")
            .eq("document_id", documentId)
        ).data,
      ).toHaveLength(1);
      await owner
        .from("publications")
        .update({ is_public: false })
        .eq("document_id", documentId);
      expect(
        (
          await anonymous
            .from("publications")
            .select("*")
            .eq("document_id", documentId)
        ).data,
      ).toEqual([]);
    });
  },
);
