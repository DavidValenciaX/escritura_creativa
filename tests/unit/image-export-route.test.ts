import { beforeEach, describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  user: "owner",
  allowed: true,
  limit: vi.fn(),
  row: {
    id: "11111111-1111-4111-8111-111111111111",
    owner_id: "owner",
    title: "Borrador privado",
    written_on: "2026-10-14",
    signature: "Autor",
    content: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Sin publicar" }],
        },
      ],
    },
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  service: () => ({ rpc: mocks.limit }),
}));
vi.mock("@/lib/http", async () => ({
  ...(await vi.importActual("@/lib/http")),
  authenticated: async () => ({
    user: { id: mocks.user },
    db: {
      from: (table: string) => {
        expect(table).toBe("documents");
        const filters: [string, unknown][] = [];
        const query = {
          select: () => query,
          eq: (key: string, value: unknown) => {
            filters.push([key, value]);
            return query;
          },
          maybeSingle: async () => ({
            error: null,
            data: filters.every(
              ([key, value]) =>
                (mocks.row as Record<string, unknown>)[key] === value,
            )
              ? mocks.row
              : null,
          }),
        };
        return query;
      },
    },
  }),
}));
import { POST } from "../../src/app/api/share-images/route";
const request = () =>
  new Request("https://app.example/api/share-images", {
    method: "POST",
    headers: { origin: "https://app.example" },
    body: JSON.stringify({ documentId: mocks.row.id }),
  });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = "owner";
  mocks.limit.mockResolvedValue({ data: true, error: null });
});
describe("private draft image export", () => {
  it("exports the owner's draft without a publication and returns a private response", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    const body = await response.json();
    expect(body.document.title).toBe("Borrador privado");
    expect(body.text).toBe("Sin publicar\n\nAutor");
  });
  it("does not give another account access to the draft", async () => {
    mocks.user = "stranger";
    expect((await POST(request())).status).toBe(404);
    expect(mocks.limit).not.toHaveBeenCalled();
  });
  it("enforces the existing export rate limit", async () => {
    mocks.limit.mockResolvedValue({ data: false, error: null });
    expect((await POST(request())).status).toBe(429);
  });
});
