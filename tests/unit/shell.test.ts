import { beforeEach, describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const account = vi.hoisted(() => ({
  profile: {
    display_name: "Persona",
    avatar_upload_id: "11111111-1111-4111-8111-111111111111" as string | null,
    avatar_resource_id: null as string | null,
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  configured: () => true,
  session: async () => ({ id: "owner", email: "private@example.com" }),
  supabase: async () => ({
    rpc: async () => ({ data: false }),
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: account.profile }) }),
      }),
    }),
  }),
}));
import { Shell } from "../../src/components/shell";
beforeEach(() => {
  account.profile.avatar_upload_id = "11111111-1111-4111-8111-111111111111";
  account.profile.avatar_resource_id = null;
});
describe("account avatar in the header", () => {
  it("displays the uploaded image instead of the initial", async () => {
    const html = renderToStaticMarkup(await Shell({ children: "Contenido" }));
    expect(html).toContain(
      'src="/api/avatar/11111111-1111-4111-8111-111111111111"',
    );
    expect(html).toContain("account-avatar");
    expect(html).not.toContain("private@example.com");
  });
  it("keeps community avatars and initial fallback available", async () => {
    account.profile.avatar_upload_id = null;
    account.profile.avatar_resource_id = "22222222-2222-4222-8222-222222222222";
    expect(
      renderToStaticMarkup(await Shell({ children: "Contenido" })),
    ).toContain('src="/api/resource/22222222-2222-4222-8222-222222222222"');
    account.profile.avatar_resource_id = null;
    expect(
      renderToStaticMarkup(await Shell({ children: "Contenido" })),
    ).toContain('class="avatar">P</span>');
  });
});
