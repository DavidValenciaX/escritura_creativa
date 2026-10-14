import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
describe("migrations and PostgreSQL RLS", () => {
  let pg: PGlite;
  const owner = randomUUID(),
    reader = randomUUID(),
    stranger = randomUUID(),
    book = randomUUID(),
    doc = randomUUID();
  const appearance = {
    paper: "cream",
    titleFont: "caveat",
    bodyFont: "lora",
    fontSize: 18,
    lineHeight: 1.8,
    ink: "#34312d",
  };
  async function as<T>(
    role: "anon" | "authenticated",
    id: string | null,
    email: string,
    run: () => Promise<T>,
  ): Promise<T> {
    await pg.exec(`set role ${role}`);
    await pg.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({ sub: id, email }),
    ]);
    try {
      return await run();
    } finally {
      await pg.exec("reset role");
    }
  }
  beforeAll(async () => {
    pg = new PGlite();
    await pg.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema storage;
   create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
   create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
   create function auth.uid() returns uuid language sql stable as $$select nullif(auth.jwt()->>'sub','')::uuid$$;
   create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint);
   create publication supabase_realtime;`);
    for (const file of readdirSync(
      join(process.cwd(), "supabase/migrations"),
    ).sort()) {
      let sql = readFileSync(
        join(process.cwd(), "supabase/migrations", file),
        "utf8",
      );
      sql = sql.replace("create extension if not exists pgcrypto;", "");
      await pg.exec(sql);
    }
    await pg.exec(
      "grant usage on schema public,auth to anon,authenticated;grant select,insert,update,delete on all tables in schema public to anon,authenticated;grant execute on all functions in schema auth to anon,authenticated;",
    );
    for (const [id, email] of [
      [owner, "owner@example.com"],
      [reader, "reader@example.com"],
      [stranger, "stranger@example.com"],
    ])
      await pg.query("insert into auth.users(id,email) values($1,$2)", [
        id,
        email,
      ]);
    await as("authenticated", owner, "owner@example.com", async () => {
      await pg.query(
        "insert into notebooks(id,owner_id,title) values($1,$2,$3)",
        [book, owner, "Cartas"],
      );
      await pg.query(
        "insert into documents(id,owner_id,notebook_id,title,appearance) values($1,$2,$3,$4,$5)",
        [doc, owner, book, "Una carta", JSON.stringify(appearance)],
      );
    });
  }, 60000);
  afterAll(async () => {
    await pg?.close();
  });
  it("runs all migrations and seeds idempotently", async () => {
    const seed = readFileSync(join(process.cwd(), "supabase/seed.sql"), "utf8");
    await pg.exec(seed);
    await pg.exec(seed);
    expect(
      (
        await pg.query<{ count: number }>(
          "select count(*)::int as count from resources",
        )
      ).rows[0].count,
    ).toBe(16);
    expect(
      (
        await pg.query<{ count: number }>(
          "select count(*)::int as count from profiles",
        )
      ).rows[0].count,
    ).toBe(3);
  });
  it("keeps avatar uploads private and rejects assigning another account's avatar", async () => {
    const avatar = randomUUID(),
      otherAvatar = randomUUID();
    await pg.query(
      "insert into avatars(id,owner_id,storage_path) values($1,$2,$3),($4,$5,$6)",
      [
        avatar,
        owner,
        `${owner}/${avatar}.webp`,
        otherAvatar,
        stranger,
        `${stranger}/${otherAvatar}.webp`,
      ],
    );
    await as("anon", null, "", async () => {
      expect((await pg.query("select * from avatars")).rows).toHaveLength(0);
    });
    await as("authenticated", owner, "owner@example.com", async () => {
      expect((await pg.query("select * from avatars")).rows).toHaveLength(1);
      await expect(
        pg.query("update profiles set avatar_upload_id=$1 where id=$2", [
          otherAvatar,
          owner,
        ]),
      ).rejects.toThrow("pertenecer");
      await pg.query(
        "update profiles set avatar_upload_id=$1,handle='mi-nombre-publico' where id=$2",
        [avatar, owner],
      );
      const profile = await pg.query<{ id: string; handle: string }>(
        "select id,handle from profiles where id=$1",
        [owner],
      );
      expect(profile.rows[0]).toEqual({
        id: owner,
        handle: "mi-nombre-publico",
      });
      await expect(
        pg.query(
          "insert into avatars(owner_id,storage_path) values($1,'forged.webp')",
          [owner],
        ),
      ).rejects.toThrow("row-level security");
    });
    expect(
      (
        await pg.query<{ public: boolean }>(
          "select public from storage.buckets where id='avatars'",
        )
      ).rows[0].public,
    ).toBe(false);
    await pg.query("update profiles set avatar_upload_id=null where id=$1", [
      owner,
    ]);
  });
  it("registers an explicit public username and protects the authentication rate limiter", async () => {
    const userId = randomUUID();
    await pg.query(
      "insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)",
      [
        userId,
        "signup@example.com",
        { public_handle: "nuevo-usuario", name: "Nuevo usuario" },
      ],
    );
    expect(
      (
        await pg.query<{ handle: string }>(
          "select handle from profiles where id=$1",
          [userId],
        )
      ).rows[0].handle,
    ).toBe("nuevo-usuario");
    await pg.query("delete from auth.users where id=$1", [userId]);
    await as("anon", null, "", async () => {
      await expect(
        pg.query("select consume_auth_attempt('forged')"),
      ).rejects.toThrow("permission denied");
      expect((await pg.query("select * from auth_attempts")).rows).toHaveLength(
        0,
      );
    });
    for (let i = 1; i <= 31; i++) {
      const result = await pg.query<{ allowed: boolean }>(
        "select consume_auth_attempt('test-client') as allowed",
      );
      expect(result.rows[0].allowed).toBe(i <= 30);
    }
    await pg.exec(
      "update auth_attempts set started_at=now()-interval '16 minutes'",
    );
    expect(
      (
        await pg.query<{ allowed: boolean }>(
          "select consume_auth_attempt('test-client') as allowed",
        )
      ).rows[0].allowed,
    ).toBe(true);
  });
  it("does not expose drafts or tokens to recipients or strangers", async () => {
    for (const [id, email] of [
      [reader, "reader@example.com"],
      [stranger, "stranger@example.com"],
    ])
      await as("authenticated", id, email, async () => {
        expect((await pg.query("select * from documents")).rows).toEqual([]);
        expect((await pg.query("select * from share_links")).rows).toEqual([]);
      });
    await as("anon", null, "", async () =>
      expect((await pg.query("select * from documents")).rows).toEqual([]),
    );
  });
  it("rejects forged notebook ownership and grants", async () => {
    await as("authenticated", stranger, "stranger@example.com", async () => {
      await expect(
        pg.query(
          "insert into documents(owner_id,notebook_id,title) values($1,$2,$3)",
          [stranger, book, "Intruso"],
        ),
      ).rejects.toThrow("invalid notebook");
      await expect(
        pg.query(
          "insert into grants(owner_id,document_id,recipient_email) values($1,$2,$3)",
          [stranger, doc, "stranger@example.com"],
        ),
      ).rejects.toThrow("row-level security");
    });
  });
  it("shares snapshots and future notebook entries while preserving draft privacy", async () => {
    await as("authenticated", owner, "owner@example.com", async () => {
      await pg.query("select publish_document($1,1,false)", [doc]);
      await pg.query(
        "insert into grants(owner_id,notebook_id,recipient_email) values($1,$2,$3)",
        [owner, book, "reader@example.com"],
      );
    });
    await as("authenticated", reader, "reader@example.com", async () => {
      expect(
        (await pg.query("select * from read_notebook($1)", [book])).rows,
      ).toHaveLength(1);
      expect((await pg.query("select * from documents")).rows).toEqual([]);
    });
    await as("authenticated", owner, "owner@example.com", async () => {
      const payload = {
        title: "Todavía no publicar",
        written_on: "2026-10-11",
        content: { type: "doc", content: [{ type: "paragraph" }] },
        appearance,
        signature: "",
        notebook_id: book,
        position: 0,
      };
      await pg.query("select save_document($1,1,$2)", [
        doc,
        JSON.stringify(payload),
      ]);
      const future = await pg.query<{ id: string }>(
        "insert into documents(owner_id,notebook_id,title) values($1,$2,$3) returning id",
        [owner, book, "Segunda carta"],
      );
      await pg.query("select publish_document($1,1,false)", [
        future.rows[0].id,
      ]);
    });
    await as("authenticated", reader, "reader@example.com", async () => {
      const rows = (
        await pg.query<{ title: string }>("select * from read_notebook($1)", [
          book,
        ])
      ).rows;
      expect(rows).toHaveLength(2);
      expect(rows.map((r) => r.title)).toContain("Una carta");
      expect(rows.map((r) => r.title)).not.toContain("Todavía no publicar");
    });
  });
  it("rejects concurrent stale saves and incomplete notebook reorder", async () => {
    await as("authenticated", owner, "owner@example.com", async () => {
      await expect(
        pg.query("select save_document($1,1,$2)", [
          doc,
          JSON.stringify({
            title: "Stale",
            written_on: "2026-10-11",
            content: { type: "doc" },
            appearance,
            signature: "",
            notebook_id: book,
            position: 0,
          }),
        ]),
      ).rejects.toThrow("revision_conflict");
      await expect(
        pg.query("select reorder_notebook($1,$2)", [book, [doc]]),
      ).rejects.toThrow("invalid order");
      const ids = (
        await pg.query<{ id: string }>(
          "select id from documents where notebook_id=$1",
          [book],
        )
      ).rows
        .map((r) => r.id)
        .reverse();
      await pg.query("select reorder_notebook($1,$2)", [book, ids]);
      expect(
        (
          await pg.query<{ position: number }>(
            "select position from documents where notebook_id=$1 order by position",
            [book],
          )
        ).rows.map((r) => r.position),
      ).toEqual([0, 1]);
    });
  });
  it("revokes notebook access and keeps hidden resources out of the catalogue", async () => {
    await as("authenticated", owner, "owner@example.com", async () => {
      await pg.query("delete from grants where notebook_id=$1", [book]);
    });
    await as("authenticated", reader, "reader@example.com", async () => {
      expect(
        (await pg.query("select * from read_notebook($1)", [book])).rows,
      ).toEqual([]);
      expect(
        (await pg.query("select * from notebooks where id=$1", [book])).rows,
      ).toEqual([]);
    });
    await pg.query(
      "update resources set hidden=true where builtin_key='cream'",
    );
    await as("anon", null, "", async () =>
      expect(
        (await pg.query("select * from resources where builtin_key='cream'"))
          .rows,
      ).toEqual([]),
    );
    expect(
      (await pg.query("select * from resources where builtin_key='cream'"))
        .rows,
    ).toHaveLength(1);
  });
  it("blocks republication after moderation and prevents admin escalation", async () => {
    await pg.query("insert into blocked_publications(document_id) values($1)", [
      doc,
    ]);
    await as("authenticated", owner, "owner@example.com", async () => {
      await expect(
        pg.query(
          "update publications set is_public=true where document_id=$1",
          [doc],
        ),
      ).rejects.toThrow("publication blocked");
      await expect(
        pg.query("insert into admins(user_id) values($1)", [owner]),
      ).rejects.toThrow("row-level security");
    });
  });
});
