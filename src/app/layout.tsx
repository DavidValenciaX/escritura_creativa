import type { Metadata } from "next";
import "@fontsource/caveat/latin-400.css";
import "@fontsource/dancing-script/latin-400.css";
import "@fontsource/kalam/latin-400.css";
import "@fontsource/patrick-hand/latin-400.css";
import "@fontsource/courier-prime/latin-400.css";
import "@fontsource/special-elite/latin-400.css";
import "@fontsource/lora/latin-400.css";
import "@fontsource/eb-garamond/latin-400.css";
import "./globals.css";
export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
  title: {
    default: "Escritura Creativa · Tu estudio de palabras",
    template: "%s · Escritura Creativa",
  },
  description:
    "Un estudio para escribir cartas, poemas e historias con papeles y tipografías que les dan vida.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
