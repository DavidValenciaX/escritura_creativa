import { beforeEach, describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
  reset: vi.fn(),
  limit: vi.fn(),
  profile: vi.fn(),
  user: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  configured: () => true,
  service: () => ({
    rpc: mocks.limit,
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: mocks.profile }) }),
    }),
    auth: { admin: { getUserById: mocks.user } },
  }),
  supabase: async () => ({
    auth: {
      signInWithPassword: mocks.signIn,
      signUp: mocks.signUp,
      resetPasswordForEmail: mocks.reset,
    },
  }),
}));
import { POST } from "../../src/app/api/auth/route";
function request(body: object, origin = "https://app.example") {
  return new Request("https://app.example/api/auth", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.limit.mockResolvedValue({ data: true, error: null });
  mocks.profile.mockResolvedValue({ data: { id: "user-id" }, error: null });
  mocks.user.mockResolvedValue({
    data: { user: { email: "private@example.com" } },
    error: null,
  });
  mocks.signIn.mockResolvedValue({ error: null });
});
describe("username authentication", () => {
  it("rejects malformed and oversized bodies without logging submitted credentials", async () => {
    const malformed = new Request("https://app.example/api/auth", {
      method: "POST",
      headers: { origin: "https://app.example" },
      body: '{"password":"do-not-log"',
    });
    const response = await POST(malformed);
    expect(response.status).toBe(400);
    expect(await response.text()).not.toContain("do-not-log");
    const tooLarge = await POST(
      request({
        action: "login",
        login: "usuario",
        password: "x".repeat(9000),
      }),
    );
    expect(tooLarge.status).toBe(413);
    expect(mocks.profile).not.toHaveBeenCalled();
  });
  it("resolves a username privately and never returns the associated email", async () => {
    const response = await POST(
      request({
        action: "login",
        login: "usuario",
        password: "secret-password",
      }),
    );
    expect(response.status).toBe(200);
    expect(mocks.signIn).toHaveBeenCalledWith({
      email: "private@example.com",
      password: "secret-password",
    });
    expect(await response.text()).not.toContain("private@example.com");
  });
  it("returns the same failure for missing usernames and bad passwords", async () => {
    mocks.signIn.mockResolvedValue({ error: { message: "bad credentials" } });
    const wrong = await POST(
      request({ action: "login", login: "usuario", password: "wrong" }),
    );
    mocks.profile.mockResolvedValue({ data: null, error: null });
    const missing = await POST(
      request({ action: "login", login: "missing", password: "wrong" }),
    );
    expect(wrong.status).toBe(401);
    expect(await wrong.json()).toEqual(await missing.json());
  });
  it("blocks cross-origin and excessive attempts before resolving user identities", async () => {
    const forbidden = await POST(
      request(
        { action: "login", login: "usuario", password: "wrong" },
        "https://other.example",
      ),
    );
    expect(forbidden.status).toBe(403);
    expect(mocks.profile).not.toHaveBeenCalled();
    mocks.limit.mockResolvedValue({ data: false, error: null });
    expect(
      (
        await POST(
          request({ action: "login", login: "usuario", password: "wrong" }),
        )
      ).status,
    ).toBe(429);
    expect(mocks.profile).not.toHaveBeenCalled();
  });
  it("creates an email-confirmed registration flow with the chosen public username", async () => {
    mocks.profile.mockResolvedValue({ data: null, error: null });
    mocks.signUp.mockResolvedValue({ data: { session: null }, error: null });
    const response = await POST(
      request({
        action: "signup",
        login: "new@example.com",
        password: "Password123!",
        handle: "nuevo-usuario",
        name: "Nombre",
      }),
    );
    expect(response.status).toBe(200);
    expect((await response.json()).signedIn).toBe(false);
    expect(mocks.signUp.mock.calls[0][0].options.data).toEqual({
      public_handle: "nuevo-usuario",
      name: "Nombre",
    });
  });
});
