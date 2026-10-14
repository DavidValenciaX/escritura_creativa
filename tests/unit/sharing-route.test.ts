import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
const mocks = vi.hoisted(() => ({
  owns: true,
  service: vi.fn(),
  ensure: vi.fn(),
  links: [] as Record<string, unknown>[],
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
      const query = {
        select: () => query,
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
          if (!admin) throw new Error("Client mutations are prohibited");
          changes = value;
          return query;
        },
        single: () => {
          single = true;
          return query;
        },
        then: (resolve: (result: object) => unknown) => {
          if (inserted)
            mocks.links.push({
              id: "22222222-2222-4222-8222-222222222222",
              revoked_at: null,
              ...inserted,
            });
          const rows = (table === "share_links" ? mocks.links : []).filter(
            (row) => filters.every(([key, value]) => row[key] === value),
          );
          if (changes) rows.forEach((row) => Object.assign(row, changes));
          return Promise.resolve({
            data: single ? rows[0] : rows,
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
function post(body: object) {
  return POST(
    new Request("https://app.example/api/sharing", {
      method: "POST",
      headers: { origin: "https://app.example" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ path: ["sharing"] }) },
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.owns = true;
  mocks.links = [];
  mocks.ensure.mockResolvedValue(undefined);
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://app.example/");
});
afterEach(() => vi.unstubAllEnvs());
it("creates and reloads the same URL for its owner and hides revoked URLs", async () => {
  const created = await post({ action: "link", ...target });
  expect(created.status).toBe(200);
  const { id, url } = await created.json();
  expect(url).toMatch(/^https:\/\/app.example\/s\/[a-f0-9]{64}$/);
  const token = url.split("/").at(-1);
  expect(mocks.links[0].token).toBe(token);
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
  expect(mocks.ensure).toHaveBeenCalledWith("owner");
  expect((await post({ action: "revokeLink", ...target, id })).status).toBe(
    200,
  );
  expect((await (await load()).json()).links[0].url).toBeNull();
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
