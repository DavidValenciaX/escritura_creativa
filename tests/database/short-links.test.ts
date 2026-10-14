import { it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { join } from "node:path";

it("backfills unique stable aliases while preserving old tokens and revocation", async () => {
  const pg = new PGlite();
  try {
    await pg.exec(`
      create table public.share_links (
        id integer primary key, token text, token_hash text,
        legacy_token_hash text, revoked_at timestamptz
      );
      insert into share_links values
        (1, repeat('a',64), repeat('b',64), null, null),
        (2, null, repeat('c',64), null, null),
        (3, repeat('d',64), repeat('e',64), repeat('f',64), '2026-10-14');
    `);
    const before = (await pg.query("select * from share_links order by id"))
      .rows;
    await pg.exec(
      readFileSync(
        join(process.cwd(), "supabase/migrations/202610140001_short_links.sql"),
        "utf8",
      ),
    );
    const after = (
      await pg.query<{ short_code: string } & Record<string, unknown>>(
        "select * from share_links order by id",
      )
    ).rows;
    expect(after.map(({ short_code, ...row }) => row)).toEqual(before);
    const codes = after.map((row) => row.short_code);
    expect(new Set(codes).size).toBe(3);
    codes.forEach((code) => expect(code).toMatch(/^[A-Za-z0-9_-]{22}$/));
    await pg.exec(
      "update share_links set token=repeat('b',64) where id=2; insert into share_links(id) values(4)",
    );
    const current = (
      await pg.query<{ short_code: string }>(
        "select short_code from share_links order by id",
      )
    ).rows;
    expect(current.slice(0, 3).map((row) => row.short_code)).toEqual(codes);
    expect(current[3].short_code).toMatch(/^[A-Za-z0-9_-]{22}$/);
    await expect(
      pg.query("insert into share_links(id,short_code) values(5,$1)", [
        codes[0],
      ]),
    ).rejects.toThrow("unique constraint");
    await expect(
      pg.exec("insert into share_links(id,short_code) values(5,'invalid')"),
    ).rejects.toThrow("check constraint");
    await expect(
      pg.exec("insert into share_links(id,short_code) values(5,null)"),
    ).rejects.toThrow("not-null constraint");
  } finally {
    await pg.close();
  }
}, 60000);
