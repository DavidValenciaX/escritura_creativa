import { WritingEditor } from "../../src/components/editor";
import { Letter } from "../../src/components/letter";
import { Reading } from "../../src/components/reading";
import { defaultAppearance, type Document } from "../../src/lib/model";

export const compositionDocument: Document = {
  id: "11111111-1111-4111-8111-111111111111",
  owner_id: "22222222-2222-4222-8222-222222222222",
  title: "Una carta para recordar las pequeñas cosas que nos hacen felices",
  written_on: "2026-10-14",
  signature: "Con cariño,\nDavid",
  appearance: {
    ...defaultAppearance,
    bodyFont: "courier",
    titleFont: "dancing",
    signatureFont: "kalam",
    signatureSize: 40,
    fontSize: 22,
  },
  notebook_id: null,
  position: 0,
  revision: 1,
  created_at: "2026-10-14",
  updated_at: "2026-10-14",
  content: {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Prueba de una imagen de papel que subí. Esta línea debe conservar sus saltos y su relación con la imagen, el título y la firma en todas las presentaciones.",
          },
        ],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "También las palabras en negrita.",
            marks: [{ type: "bold" }],
          },
        ],
      },
      {
        type: "image",
        attrs: {
          assetId: "33333333-3333-4333-8333-333333333333",
          alt: "Recuerdo",
          layout: { x: 70, y: 20, width: 18, rotation: -12, ratio: 1.5 },
        },
      },
    ],
  },
};
const publication = {
  ...compositionDocument,
  document_id: compositionDocument.id,
  is_public: false,
  published_at: "2026-10-14",
};
export function CompositionFixture() {
  return (
    <main>
      <section className="screen-only">
        <div id="composition-editor">
          <WritingEditor
            initial={compositionDocument}
            resources={[]}
            notebooks={[]}
            onBack={() => {}}
            onSaved={() => {}}
            onRefresh={() => {}}
          />
        </div>
        <div id="composition-preview">
          <Letter {...compositionDocument} />
        </div>
        <div
          id="composition-thumbnail"
          className="document-card"
          style={{ width: 320, maxWidth: "100%" }}
        >
          <div className="paper-thumbnail">
            <Letter {...compositionDocument} thumbnail />
          </div>
        </div>
        <div id="composition-shared" className="focus-reading">
          <Reading initial={[publication]} token="test-token" />
        </div>
      </section>
      <div id="composition-print" className="print-only">
        <Letter {...compositionDocument} />
      </div>
    </main>
  );
}
