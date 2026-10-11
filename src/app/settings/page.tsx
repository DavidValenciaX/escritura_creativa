import { Shell } from "@/components/shell";
import { Setup, SignInRequired } from "@/components/setup";
import { Settings } from "@/components/settings";
import { configured, session, supabase } from "@/lib/supabase/server";
export const metadata = {
  title: "Mi perfil",
  robots: { index: false, follow: false },
};
export default async function Page() {
  if (!configured())
    return (
      <Shell>
        <Setup />
      </Shell>
    );
  const user = await session();
  if (!user)
    return (
      <Shell>
        <SignInRequired />
      </Shell>
    );
  const db = await supabase();
  const { data: profile, error } = await db
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (error) throw error;
  const { data: images, error: imageError } = await db
    .from("resources")
    .select("id,name")
    .eq("kind", "image")
    .eq("hidden", false);
  if (imageError) throw imageError;
  return (
    <Shell>
      <Settings
        profile={profile}
        images={images ?? []}
        email={user.email ?? ""}
      />
    </Shell>
  );
}
