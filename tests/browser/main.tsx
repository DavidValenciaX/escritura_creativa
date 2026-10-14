import { createRoot } from "react-dom/client";
import { useState } from "react";
import { Login } from "../../src/components/login";
import { Settings } from "../../src/components/settings";
import { SocialSharing } from "../../src/components/social-sharing";
import { Reading } from "../../src/components/reading";
import { Sharing } from "../../src/components/sharing";
import { Letter } from "../../src/components/letter";
import { Studio } from "../../src/components/studio";
import { richLetter } from "./rich-letter";
import { paginateLetter } from "../../src/lib/paginate-letter";
import "@fontsource/caveat/latin-400.css";
import "@fontsource/dancing-script/latin-400.css";
import "@fontsource/kalam/latin-400.css";
import "@fontsource/patrick-hand/latin-400.css";
import "@fontsource/courier-prime/latin-400.css";
import "@fontsource/special-elite/latin-400.css";
import "@fontsource/lora/latin-400.css";
import "@fontsource/eb-garamond/latin-400.css";
import { defaultAppearance } from "../../src/lib/model";
import "../../src/app/globals.css";
const fixture = new URLSearchParams(location.search).get("fixture");
if (fixture === "pagination")
  (
    window as typeof window & { paginateForTest: typeof paginateLetter }
  ).paginateForTest = paginateLetter;
const profile = {
  id: "11111111-1111-4111-8111-111111111111",
  display_name: "Usuario",
  handle: "usuario",
  bio: "",
  avatar_resource_id: null,
  avatar_upload_id: null,
};
const publication = {
  document_id: profile.id,
  owner_id: profile.id,
  title: "Texto compartido",
  written_on: "2026-10-13",
  signature: "Autor",
  content: {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "Contenido de lectura." }],
      },
    ],
  },
  appearance: { ...defaultAppearance, paper: "lined", titleFont: "dancing" },
  published_at: "2026-10-13",
  updated_at: "2026-10-13",
  is_public: false,
  notebook_id: null,
};
function SharingFixture() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Abrir compartir</button>
      {open && (
        <Sharing
          target={{ document_id: profile.id, notebook_id: null }}
          title="Texto compartido"
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  fixture === "settings" ? (
    <Settings
      profile={profile}
      email="example@example.com"
      images={[]}
      siteUrl="https://example.com"
    />
  ) : fixture === "social" ? (
    <>
      <SocialSharing documentId={profile.id} />
      <div
        id="reference"
        className="social-export"
        style={{ left: 0, display: "none" }}
      >
        <Letter {...publication} />
      </div>
    </>
  ) : fixture === "pagination" ? (
    <>
      <SocialSharing documentId={richLetter.document_id} />
      <div
        id="reference"
        className="social-export"
        style={{ left: 0, display: "none" }}
      >
        <Letter {...richLetter} />
      </div>
    </>
  ) : fixture === "studio" ? (
    <Studio />
  ) : fixture === "sharing" ? (
    <SharingFixture />
  ) : fixture === "focus" ? (
    <main className="focus-reading">
      <Reading initial={[publication]} token="test-token" />
    </main>
  ) : (
    <Login />
  ),
);
