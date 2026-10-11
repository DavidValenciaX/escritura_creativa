import { Shell } from "@/components/shell";
import { Setup, SignInRequired } from "@/components/setup";
import { configured, session } from "@/lib/supabase/server";
import { Studio } from "@/components/studio";
import { Suspense } from "react";
export const metadata = {
  title: "Mi estudio",
  robots: { index: false, follow: false },
};
export default async function Page() {
  return (
    <Shell active="/studio">
      {!configured() ? (
        <Setup />
      ) : !(await session()) ? (
        <SignInRequired />
      ) : (
        <Suspense fallback={<p className="loading">Abriendo tu estudio…</p>}>
          <Studio />
        </Suspense>
      )}
    </Shell>
  );
}
