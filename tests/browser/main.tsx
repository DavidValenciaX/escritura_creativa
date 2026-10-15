import { createRoot } from "react-dom/client";
import { useState } from "react";
import { Login } from "../../src/components/login";
import { Settings } from "../../src/components/settings";
import { SocialSharing } from "../../src/components/social-sharing";
import { Reading } from "../../src/components/reading";
import { Sharing } from "../../src/components/sharing";
import { Letter } from "../../src/components/letter";
import { Studio } from "../../src/components/studio";
import { ResourceLibrary } from "../../src/components/resources";
import { builtins } from "../../src/lib/catalog";
import { CompositionFixture } from "./composition";
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
const notebook = {
  id: "22222222-2222-4222-8222-222222222222",
  title: "Alejandra",
  description: "Un cuaderno para compartir.",
};
const notebookPublications = [
  { ...publication, notebook_id: notebook.id },
  {
    ...publication,
    document_id: "33333333-3333-4333-8333-333333333333",
    notebook_id: notebook.id,
    title: "Otra página",
    appearance: { ...defaultAppearance, paper: "vintage" },
    content: {
      type: "doc",
      content: Array.from({ length: 20 }, () => ({
        type: "paragraph",
        content: [
          { type: "text", text: "Un escrito largo para leer con calma." },
        ],
      })),
    },
  },
];
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
  fixture === "composition" ? (
    <CompositionFixture />
  ) : fixture === "settings" ? (
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
  ) : fixture === "resources" ? (
    <ResourceLibrary
      connected
      userId={profile.id}
      initial={[
        ...builtins,
        ...[profile.id, "other-owner"].map((owner_id, index) => ({
          id: `33333333-3333-4333-8333-33333333333${index}`,
          owner_id,
          kind: "image" as const,
          name: index === 0 ? "Mi imagen" : "Imagen ajena",
          author: "",
          source: "",
          license: "CC0",
          description: "",
          tags: [],
          builtin_key: null,
          hidden: false,
        })),
      ]}
    />
  ) : fixture === "sharing" ? (
    <SharingFixture />
  ) : fixture === "notebook" || fixture === "account-notebook" ? (
    <main className={fixture === "notebook" ? "focus-reading" : "main-content"}>
      <Reading
        initial={notebookPublications}
        notebook={notebook}
        token={fixture === "notebook" ? "test-token" : undefined}
      />
    </main>
  ) : fixture === "focus" ? (
    <main className="focus-reading">
      <Reading initial={[publication]} token="test-token" />
    </main>
  ) : (
    <Login />
  ),
);
