import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultAppearance } from "../../src/lib/model";

const ownerId = "11111111-1111-4111-8111-111111111111";
const resourceId = "22222222-2222-4222-8222-222222222222";
const mocks = vi.hoisted(() => ({
  user: null as { id: string } | null,
  resources: [] as Record<string, unknown>[],
  documents: [] as Record<string, unknown>[],
  publications: [] as Record<string, unknown>[],
  upload: vi.fn(),
  remove: vi.fn(),
  download: vi.fn(),
  save: vi.fn(),
  writeError: null as { message: string } | null,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/uploads", () => ({
  prepareUpload: async () => ({
    bytes: new Uint8Array([1, 2, 3]),
    extension: "webp",
    mime: "image/webp",
  }),
  prepareAvatar: vi.fn(),
}));

function database() {
  return {
    auth: {
      getUser: async () => ({ data: { user: mocks.user }, error: null }),
    },
    rpc: (name: string, args: unknown) =>
      name === "save_document"
        ? { single: () => mocks.save(args) }
        : Promise.resolve({ data: false, error: null }),
    storage: {
      from: () => ({
        upload: mocks.upload,
        remove: mocks.remove,
        download: mocks.download,
      }),
    },
    from: (table: string) => {
      const rows =
        table === "resources"
          ? mocks.resources
          : table === "documents"
            ? mocks.documents
            : mocks.publications;
      const filters: [string, unknown][] = [];
      const memberships: [string, unknown[]][] = [];
      let changes: Record<string, unknown> | undefined;
      let inserted: Record<string, unknown> | undefined;
      let single = false;
      let count = false;
      const query = {
        select: (_columns: string, options?: { count: string }) => {
          count = !!options?.count;
          return query;
        },
        eq: (key: string, value: unknown) => {
          filters.push([key, value]);
          return query;
        },
        is: (key: string, value: unknown) => query.eq(key, value),
        in: (key: string, values: unknown[]) => {
          memberships.push([key, values]);
          return query;
        },
        gte: () => query,
        update: (value: Record<string, unknown>) => {
          changes = value;
          return query;
        },
        insert: (value: Record<string, unknown>) => {
          inserted = value;
          return query;
        },
        maybeSingle: () => {
          single = true;
          return query;
        },
        then: (resolve: (result: object) => unknown) => {
          const selected = rows.filter(
            (row) =>
              filters.every(([key, value]) => row[key] === value) &&
              memberships.every(([key, values]) => values.includes(row[key])),
          );
          const error = changes || inserted ? mocks.writeError : null;
          if (!error) {
            if (changes) selected.forEach((row) => Object.assign(row, changes));
            if (inserted) rows.push(inserted);
          }
          return Promise.resolve({
            data: single ? (selected[0] ?? null) : selected,
            count: count ? selected.length : null,
            error,
          }).then(resolve);
        },
      };
      return query;
    },
  };
}

vi.mock("@/lib/supabase/server", () => ({
  configured: () => true,
  supabase: async () => database(),
  service: () => database(),
}));

import { DELETE, GET, POST } from "../../src/app/api/[...path]/route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = { id: ownerId };
  mocks.resources = [
    {
      id: resourceId,
      owner_id: ownerId,
      kind: "image",
      name: "Mi imagen",
      builtin_key: null,
      hidden: false,
      storage_path: `${ownerId}/photo.webp`,
    },
  ];
  mocks.documents = [];
  mocks.publications = [];
  mocks.writeError = null;
  mocks.upload.mockResolvedValue({ error: null });
  mocks.remove.mockResolvedValue({ error: null });
  mocks.download.mockResolvedValue({
    data: new Blob(["image"], { type: "image/webp" }),
    error: null,
  });
  mocks.save.mockResolvedValue({ data: {}, error: null });
});

describe("body font references", () => {
  it("saves legacy signatures as body text and clears the old field", async () => {
    const docId = "33333333-3333-4333-8333-333333333333";
    const draft = {
      title: "Carta",
      written_on: "2026-10-17",
      content: { type: "doc", content: [{ type: "paragraph" }] },
      appearance: defaultAppearance,
      signature: "Con cariño,\nAutor",
      notebook_id: null,
      position: 0,
    };
    mocks.documents = [{ ...draft, id: docId, owner_id: ownerId }];
    const response = await POST(
      new Request("https://app.example/api/documents", {
        method: "POST",
        headers: { origin: "https://app.example" },
        body: JSON.stringify({ action: "save", id: docId, revision: 1, draft }),
      }),
      { params: Promise.resolve({ path: ["documents"] }) },
    );
    expect(response.status).toBe(200);
    expect(mocks.save).toHaveBeenCalledWith({
      doc: docId,
      expected_revision: 1,
      payload: {
        ...draft,
        signature: "",
        content: {
          type: "doc",
          content: [
            { type: "paragraph" },
            {
              type: "paragraph",
              content: [{ type: "text", text: "Con cariño," }],
            },
            { type: "paragraph", content: [{ type: "text", text: "Autor" }] },
          ],
        },
      },
    });
    expect(draft.signature).toBe("Con cariño,\nAutor");
  });
  it.each([
    ["font", false, false, 200],
    ["image", false, false, 400],
    ["font", true, false, 400],
    ["font", true, true, 200],
  ])(
    "checks kind=%s hidden=%s existing=%s",
    async (kind, hidden, existing, status) => {
      const docId = "33333333-3333-4333-8333-333333333333";
      mocks.resources[0] = { ...mocks.resources[0], kind, hidden };
      mocks.documents = [
        {
          id: docId,
          owner_id: ownerId,
          content: { type: "doc" },
          appearance: {
            ...defaultAppearance,
            bodyFont: existing ? resourceId : "lora",
          },
        },
      ];
      const draft = {
        title: "Carta",
        written_on: "2026-10-17",
        content: { type: "doc" },
        appearance: {
          ...defaultAppearance,
          bodyFont: resourceId,
        },
        signature: "",
        notebook_id: null,
        position: 0,
      };
      const response = await POST(
        new Request("https://app.example/api/documents", {
          method: "POST",
          headers: { origin: "https://app.example" },
          body: JSON.stringify({
            action: "save",
            id: docId,
            revision: 1,
            draft,
          }),
        }),
        { params: Promise.resolve({ path: ["documents"] }) },
      );
      expect(response.status).toBe(status);
      if (status === 200)
        expect(mocks.save).toHaveBeenCalledWith({
          doc: docId,
          expected_revision: 1,
          payload: draft,
        });
      else expect(mocks.save).not.toHaveBeenCalled();
    },
  );
});

function remove(
  origin: string | null = "https://app.example",
  id = resourceId,
) {
  return DELETE(
    new Request(`https://app.example/api/resource/${id}`, {
      method: "DELETE",
      headers: origin ? { origin } : {},
    }),
    { params: Promise.resolve({ path: ["resource", id] }) },
  );
}

function upload(
  license: string,
  metadata: Record<string, string | undefined> = {},
) {
  const form = new FormData();
  Object.entries({
    mode: "resource",
    kind: "image",
    name: "Mi imagen",
    license,
    permission: "yes",
    ...metadata,
  }).forEach(([key, value]) => {
    if (value !== undefined) form.set(key, value);
  });
  form.set("file", new File(["image"], "photo.webp", { type: "image/webp" }));
  return POST(
    new Request("https://app.example/api/upload", {
      method: "POST",
      headers: { origin: "https://app.example" },
      body: form,
    }),
    { params: Promise.resolve({ path: ["upload"] }) },
  );
}

describe("resource contributions", () => {
  it.each([{}, { author: "", source: "" }, { author: "  ", source: "  " }])(
    "accepts CC0 without attribution, source or description: %j",
    async (metadata) => {
      expect((await upload("CC0", metadata)).status).toBe(200);
      expect(mocks.resources.at(-1)).toMatchObject({
        author: "",
        source: "",
        description: "",
        owner_id: ownerId,
      });
      expect(mocks.upload).toHaveBeenCalledOnce();
    },
  );
  it.each(["CC-BY-4.0", "OFL-1.1", "Apache-2.0"])(
    "requires attribution and source for %s",
    async (license) => {
      for (const metadata of [
        {},
        { author: "Autor" },
        { source: "Creación propia" },
        { author: "  ", source: "  " },
      ]) {
        expect((await upload(license, metadata)).status).toBe(400);
      }
      expect(mocks.upload).not.toHaveBeenCalled();
      expect(
        (
          await upload(license, {
            author: " Autor ",
            source: " Creación propia ",
          })
        ).status,
      ).toBe(200);
      expect(mocks.resources.at(-1)).toMatchObject({
        author: "Autor",
        source: "Creación propia",
      });
    },
  );
  it("still requires permission for CC0", async () => {
    expect((await upload("CC0", { permission: "" })).status).toBe(400);
    expect(mocks.upload).not.toHaveBeenCalled();
  });
});

describe("resource removal", () => {
  it("removes an owner's contribution from the catalogue and retains its stored file", async () => {
    expect((await remove()).status).toBe(200);
    expect(mocks.resources[0]).toMatchObject({
      hidden: true,
      storage_path: `${ownerId}/photo.webp`,
    });
    expect(mocks.remove).not.toHaveBeenCalled();
    expect((await remove()).status).toBe(200);
  });
  it("does not let another account remove a resource", async () => {
    mocks.user = { id: "someone-else" };
    expect((await remove()).status).toBe(404);
    expect(mocks.resources[0].hidden).toBe(false);
  });
  it("protects built-in resources even if they have the same owner", async () => {
    mocks.resources[0].builtin_key = "cream";
    expect((await remove()).status).toBe(404);
    expect(mocks.resources[0].hidden).toBe(false);
  });
  it("requires authentication", async () => {
    mocks.user = null;
    expect((await remove()).status).toBe(401);
    expect(mocks.resources[0].hidden).toBe(false);
  });
  it.each([null, "https://other.example"])(
    "rejects origin %s",
    async (origin) => {
      expect((await remove(origin)).status).toBe(403);
      expect(mocks.resources[0].hidden).toBe(false);
    },
  );
  it("rejects invalid and nonexistent ids", async () => {
    expect((await remove("https://app.example", "invalid")).status).toBe(400);
    mocks.resources = [];
    expect((await remove()).status).toBe(404);
  });
  it("keeps removed resources accessible to existing texts but unavailable to unrelated readers", async () => {
    await remove();
    const get = () =>
      GET(new Request(`https://app.example/api/resource/${resourceId}`), {
        params: Promise.resolve({ path: ["resource", resourceId] }),
      });
    mocks.user = null;
    expect((await get()).status).toBe(404);
    mocks.publications = [
      {
        content: {
          type: "doc",
          content: [{ type: "image", attrs: { resourceId } }],
        },
        appearance: defaultAppearance,
      },
    ];
    expect((await get()).status).toBe(200);
    mocks.publications = [];
    mocks.user = { id: "existing-writer" };
    mocks.documents = [
      {
        content: { type: "doc" },
        appearance: { ...defaultAppearance, paper: resourceId },
      },
    ];
    expect((await get()).status).toBe(200);
  });
});
