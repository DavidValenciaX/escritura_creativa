import { beforeEach, describe, expect, it, vi } from "vitest";
const store = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[],
  documents: [] as Record<string, unknown>[],
  publications: [] as Record<string, unknown>[],
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  service: () => ({
    from: (table: string) => {
      const filters: [string, unknown][] = [];
      let update: Record<string, unknown> | undefined;
      let single = false;
      const query = {
        select: () => query,
        eq: (key: string, value: unknown) => {
          filters.push([key, value]);
          return query;
        },
        is: (key: string, value: unknown) => {
          filters.push([key, value]);
          return query;
        },
        in: (key: string, values: unknown[]) => {
          filters.push([key, values]);
          return query;
        },
        order: () => query,
        update: (value: Record<string, unknown>) => {
          update = value;
          return query;
        },
        maybeSingle: () => {
          single = true;
          return query;
        },
        single: () => {
          single = true;
          return query;
        },
        then: (resolve: (result: object) => unknown) => {
          const source =
            table === "share_links"
              ? store.rows
              : table === "documents"
                ? store.documents
                : table === "notebooks"
                  ? [{ id: "book", title: "Cuaderno" }]
                  : store.publications;
          const rows = source.filter((row) =>
            filters.every(([key, value]) =>
              Array.isArray(value)
                ? value.includes(row[key])
                : row[key] === value,
            ),
          );
          if (update) rows.forEach((row) => Object.assign(row, update));
          return Promise.resolve({
            data: single ? (rows[0] ?? null) : rows.map((row) => ({ ...row })),
            error: null,
          }).then(resolve);
        },
      };
      return query;
    },
  }),
}));
import {
  ensureRecoverableLinks,
  hashToken,
  readPublication,
  resolveLink,
} from "../../src/lib/access";

describe("recoverable sharing links", () => {
  const oldToken = "a".repeat(64);
  const shortCode = "Abcdefghi_0123456789-w";
  beforeEach(() => {
    store.documents = [];
    store.publications = [{ document_id: "document", title: "Publicado" }];
    store.rows = [
      {
        id: "link",
        owner_id: "owner",
        document_id: "document",
        token: null,
        short_code: shortCode,
        token_hash: hashToken(oldToken),
        legacy_token_hash: null,
        revoked_at: null,
      },
    ];
  });
  it("upgrades only active links of the authenticated owner and keeps the old URL working", async () => {
    store.rows.push({ ...store.rows[0], id: "other", owner_id: "stranger" });
    store.rows.push({
      ...store.rows[0],
      id: "revoked",
      revoked_at: "2026-10-13",
    });
    await ensureRecoverableLinks("owner");
    const token = store.rows[0].token as string;
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(store.rows[0].token_hash).toBe(hashToken(token));
    expect(store.rows[0].legacy_token_hash).toBe(hashToken(oldToken));
    expect(store.rows[1].token).toBeNull();
    expect(store.rows[2].token).toBeNull();
    // Remove the deliberately duplicated fixture hash before testing resolution.
    store.rows = [store.rows[0]];
    expect((await resolveLink(oldToken)).publications[0].title).toBe(
      "Publicado",
    );
    expect((await resolveLink(token)).publications[0].title).toBe("Publicado");
    expect((await resolveLink(shortCode)).publications[0].title).toBe(
      "Publicado",
    );
    await ensureRecoverableLinks("owner");
    expect(store.rows[0].token).toBe(token);
    store.rows[0].revoked_at = "2026-10-13";
    await expect(resolveLink(oldToken)).rejects.toMatchObject({ status: 404 });
    await expect(resolveLink(token)).rejects.toMatchObject({ status: 404 });
    await expect(resolveLink(shortCode)).rejects.toMatchObject({ status: 404 });
  });
  it("opens a short alias before legacy recovery and restricts reads to its target", async () => {
    expect((await resolveLink(shortCode)).publications[0].title).toBe(
      "Publicado",
    );
    expect((await readPublication("document", shortCode))?.title).toBe(
      "Publicado",
    );
    expect(await readPublication("unrelated", shortCode)).toBeNull();
    await expect(resolveLink("z".repeat(22))).rejects.toMatchObject({
      status: 404,
    });
  });
  it("resolves a notebook alias to its published entries in notebook order", async () => {
    store.rows[0].document_id = null;
    store.rows[0].notebook_id = "book";
    store.documents = [
      { id: "second", notebook_id: "book", position: 0 },
      { id: "first", notebook_id: "book", position: 1 },
      { id: "draft", notebook_id: "book", position: 2 },
    ];
    store.publications = [
      { document_id: "first", title: "Primero" },
      { document_id: "second", title: "Segundo" },
      { document_id: "unrelated", title: "Privado" },
    ];
    const data = await resolveLink(shortCode);
    expect(data.notebook?.title).toBe("Cuaderno");
    expect(data.publications.map((p) => p.document_id)).toEqual([
      "second",
      "first",
    ]);
    store.publications.push({ document_id: "draft", title: "Ahora publicado" });
    expect((await resolveLink(shortCode)).publications).toHaveLength(3);
    store.rows[0].revoked_at = "2026-10-14";
    await expect(resolveLink(shortCode)).rejects.toMatchObject({ status: 404 });
  });
  it("rejects malformed anonymous tokens", async () => {
    await expect(resolveLink("not-a-token")).rejects.toMatchObject({
      status: 404,
    });
  });
});
