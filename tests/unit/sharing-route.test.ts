import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { createHash, randomUUID } from "node:crypto";
const mocks = vi.hoisted(() => ({
  owns: true,
  service: vi.fn(),
  ensure: vi.fn(),
  links: [] as Record<string, unknown>[],
  documents: [] as Record<string, unknown>[],
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/access", async () => {
  const { createHash } = await import("node:crypto");
  return {
    ensureRecoverableLinks: mocks.ensure,
    hashToken: (token: string) =>
      createHash("sha256").update(token).digest("hex"),
    readPublication: vi.fn(),
    resolveLink: vi.fn(),
  };
});
function database(admin = false) {
  return {
    rpc: async () => ({ data: mocks.owns, error: null }),
    from: (table: string) => {
      const filters: [string, unknown][] = [];
      let inserted: Record<string, unknown> | undefined;
      let changes: Record<string, unknown> | undefined;
      let single = false;
      let columns = "*";
      const query = {
        select: (value: string) => {
          columns = value;
          return query;
        },
        order: () => query,
        eq: (key: string, value: unknown) => {
          filters.push([key, value]);
          return query;
        },
        insert: (value: Record<string, unknown>) => {
          if (!admin) throw new Error("Client mutations are prohibited");
          inserted = value;
          return query;
        },
        update: (value: Record<string, unknown>) => {
          if (!admin && table === "share_links")
            throw new Error("Client mutations are prohibited");
          changes = value;
          return query;
        },
        single: () => {
          single = true;
          return query;
        },
        maybeSingle: () => {
          single = true;
          return query;
        },
        then: (resolve: (result: object) => unknown) => {
          if (inserted)
            mocks.links.push({
              id: "22222222-2222-4222-8222-222222222222",
              revoked_at: null,
              short_code: Buffer.from(
                randomUUID().replaceAll("-", ""),
                "hex",
              ).toString("base64url"),
              ...inserted,
            });
          const rows = (
            table === "share_links"
              ? mocks.links
              : table === "documents"
                ? mocks.documents
                : []
          ).filter((row) =>
            filters.every(([key, value]) => row[key] === value),
          );
          if (changes) rows.forEach((row) => Object.assign(row, changes));
          const selected = rows.map((row) =>
            columns === "*"
              ? { ...row }
              : Object.fromEntries(
                  columns.split(",").map((key) => [key, row[key]]),
                ),
          );
          return Promise.resolve({
            data: single ? selected[0] : selected,
            error: null,
          }).then(resolve);
        },
      };
      return query;
    },
  };
}
vi.mock("@/lib/supabase/server", () => ({
  configured: () => true,
  service: () => {
    mocks.service();
    return database(true);
  },
  supabase: vi.fn(),
}));
vi.mock("@/lib/http", async () => ({
  ...(await vi.importActual("@/lib/http")),
  authenticated: async () => ({ user: { id: "owner" }, db: database() }),
}));
import { GET, POST } from "../../src/app/api/[...path]/route";
const target = {
  document_id: "11111111-1111-4111-8111-111111111111",
  notebook_id: null,
};
function post(body: object, path = "sharing") {
  return POST(
    new Request(`https://app.example/api/${path}`, {
      method: "POST",
      headers: { origin: "https://app.example" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ path: [path] }) },
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.owns = true;
  mocks.links = [];
  mocks.documents = [
    {
      id: target.document_id,
      owner_id: "owner",
      notebook_id: null,
      revision: 1,
      title: "Borrador",
      content: { type: "doc" },
    },
  ];
  mocks.ensure.mockResolvedValue(undefined);
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://app.example/");
});
afterEach(() => vi.unstubAllEnvs());
it("creates and reloads the same URL for its owner and hides revoked URLs", async () => {
  const created = await post({ action: "link", ...target });
  expect(created.status).toBe(200);
  const { id, url } = await created.json();
  expect(url).toMatch(/^https:\/\/app.example\/s\/[A-Za-z0-9_-]{22}$/);
  expect(mocks.links[0].short_code).toBe(url.split("/").at(-1));
  const token = mocks.links[0].token as string;
  expect(token).toMatch(/^[a-f0-9]{64}$/);
  expect(mocks.links[0].token_hash).toBe(
    createHash("sha256").update(token).digest("hex"),
  );
  const load = () =>
    GET(new Request("https://app.example/api/studio"), {
      params: Promise.resolve({ path: ["studio"] }),
    });
  const loaded = await load();
  expect(loaded.headers.get("cache-control")).toBe("private, no-store");
  const data = await loaded.json();
  expect(data.links[0].url).toBe(url);
  expect(data.links[0]).not.toHaveProperty("token");
  expect(data.links[0]).not.toHaveProperty("short_code");
  expect(mocks.ensure).toHaveBeenCalledWith("owner");
  expect((await post({ action: "revokeLink", ...target, id })).status).toBe(
    200,
  );
  expect((await (await load()).json()).links[0].url).toBeNull();
});
it("creates short notebook URLs and uses the request origin when no site URL is configured", async () => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", undefined);
  const notebook = { document_id: null, notebook_id: target.document_id };
  const created = await post({ action: "link", ...notebook });
  expect(created.status).toBe(200);
  const { url } = await created.json();
  expect(url).toBe(`https://app.example/s/${mocks.links[0].short_code}`);
  expect(mocks.links[0]).toMatchObject(notebook);
});
it("lists the stable short URL for an existing long link without changing its token", async () => {
  const token = "a".repeat(64);
  const short_code = "Abcdefghi_0123456789-w";
  mocks.links = [
    {
      ...target,
      id: target.document_id,
      owner_id: "owner",
      token,
      short_code,
      revoked_at: null,
    },
  ];
  const loaded = await GET(new Request("https://app.example/api/studio"), {
    params: Promise.resolve({ path: ["studio"] }),
  });
  expect(loaded.status).toBe(200);
  const data = await loaded.json();
  expect(data.links[0].url).toBe(`https://app.example/s/${short_code}`);
  expect(data.links[0]).not.toHaveProperty("token");
  expect(mocks.links[0].token).toBe(token);
});
it("does not use privileged writes when the account does not own the target", async () => {
  mocks.owns = false;
  expect((await post({ action: "link", ...target })).status).toBe(403);
  expect(
    (await post({ action: "revokeLink", ...target, id: target.document_id }))
      .status,
  ).toBe(403);
  expect(mocks.service).not.toHaveBeenCalled();
  expect(mocks.links).toHaveLength(0);
});
it("moves only notebook membership, rejects stale revisions and foreign notebooks", async () => {
  const doc = mocks.documents[0];
  const book = "33333333-3333-4333-8333-333333333333";
  const move = (notebook_id: string | null, revision: number) =>
    post(
      { action: "move", id: target.document_id, notebook_id, revision },
      "documents",
    );
  mocks.owns = false;
  expect((await move(book, 1)).status).toBe(403);
  expect(doc.notebook_id).toBeNull();
  mocks.owns = true;
  expect((await move(book, 1)).status).toBe(200);
  expect(doc).toMatchObject({
    notebook_id: book,
    revision: 2,
    title: "Borrador",
    content: { type: "doc" },
  });
  expect((await move(null, 1)).status).toBe(409);
  expect(doc.notebook_id).toBe(book);
  expect((await move(null, 2)).status).toBe(200);
  expect(doc.notebook_id).toBeNull();
  doc.owner_id = "stranger";
  expect((await move(book, 3)).status).toBe(404);
  expect(mocks.service).not.toHaveBeenCalled();
});
