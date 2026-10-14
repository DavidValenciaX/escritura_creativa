import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Reading } from "@/components/reading";
import { configured } from "@/lib/supabase/server";
import { resolveLink } from "@/lib/access";
export const dynamic = "force-dynamic";
type Props = { params: Promise<{ token: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (!configured()) return { robots: { index: false, follow: false } };
  try {
    const { token } = await params;
    const data = await resolveLink(token);
    const title =
      data.notebook?.title ?? data.publications[0]?.title ?? "Un texto para ti";
    return {
      title,
      description: "Una página compartida en Escritura Creativa.",
      robots: { index: false, follow: false },
      openGraph: {
        title,
        description: "Una página compartida en Escritura Creativa.",
      },
    };
  } catch {
    return {
      title: "Enlace no disponible",
      robots: { index: false, follow: false },
    };
  }
}
export default async function Page({ params }: Props) {
  if (!configured()) notFound();
  const { token } = await params;
  let data;
  try {
    data = await resolveLink(token);
  } catch {
    notFound();
  }
  return (
    <main className="focus-reading">
      <Reading
        initial={data.publications}
        token={token}
        notebook={data.notebook ?? undefined}
      />
    </main>
  );
}
