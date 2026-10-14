"use client";
import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { api, ErrorMessage } from "./ui";
import { Letter } from "./letter";
import type { Publication } from "@/lib/model";
type Export = { title: string; text: string; images: string[] };
export function SocialSharing({ documentId }: { documentId: string }) {
  const [result, setResult] = useState<Export | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [snapshot, setSnapshot] = useState<Publication | null>(null);
  const capture = useRef<HTMLDivElement>(null);
  return (
    <section className="sharing-section">
      <h3>Instagram y otras redes</h3>
      <p className="muted">
        Prepara tarjetas de texto para publicarlas desde tu cuenta personal. Las
        imágenes conservan el papel, la fecha, las fuentes, el formato y las
        fotografías de la versión publicada. Después eliges la aplicación y
        confirmas allí.
      </p>
      <button
        className="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          setMessage("");
          setResult(null);
          setFiles([]);
          try {
            const data = await api<{
              title: string;
              text: string;
              publication: Publication;
            }>("share-images", { documentId });
            flushSync(() => setSnapshot(data.publication));
            const letter =
              capture.current?.querySelector<HTMLElement>(".letter");
            if (!letter)
              throw new Error("No se pudo preparar la vista de lectura.");
            const { exportLetter } = await import("@/lib/export-letter");
            const images = await exportLetter(letter);
            const prepared = await Promise.all(
              images.map(
                async (image, i) =>
                  new File(
                    [await (await fetch(image)).blob()],
                    `escrito-${i + 1}.jpg`,
                    { type: "image/jpeg" },
                  ),
              ),
            );
            setResult({ title: data.title, text: data.text, images });
            setFiles(prepared);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setSnapshot(null);
            setBusy(false);
          }
        }}
      >
        {busy ? "Preparando imágenes…" : "Preparar imágenes para Instagram"}
      </button>
      <ErrorMessage message={error} />
      {message && <p role="status">{message}</p>}
      {result && (
        <>
          <p>
            {result.images.length} tarjeta
            {result.images.length === 1 ? "" : "s"} · versión de lectura
            publicada.
          </p>
          <div className="social-cards">
            {result.images.map((src, i) => (
              <figure key={i}>
                <img
                  src={src}
                  alt={`Tarjeta ${i + 1} de ${result.title}`}
                  width={216}
                  height={270}
                />
                <figcaption>
                  <a
                    className="text-button"
                    href={src}
                    download={`escrito-${i + 1}.jpg`}
                  >
                    Descargar imagen {i + 1}
                  </a>
                </figcaption>
              </figure>
            ))}
          </div>
          <div className="social-sharing-actions">
            <button
              className="button"
              onClick={async () => {
                setError("");
                setMessage("");
                try {
                  if (!navigator.share || !navigator.canShare?.({ files })) {
                    setMessage(
                      "Descarga las imágenes y selecciónalas al crear una publicación en Instagram o Facebook.",
                    );
                    return;
                  }
                  await navigator.share({ files });
                  setMessage(
                    "Imágenes enviadas al menú de compartir. Completa la publicación en la aplicación elegida.",
                  );
                } catch (e) {
                  if ((e as Error).name !== "AbortError")
                    setError(
                      "No se pudieron enviar las imágenes. Puedes descargarlas y subirlas desde la aplicación.",
                    );
                }
              }}
            >
              Compartir imágenes con una aplicación
            </button>
            <button
              className="text-button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    `${result.title}\n\n${result.text}`,
                  );
                  setMessage("Texto copiado para pegarlo en tu publicación.");
                } catch {
                  setError("No se pudo copiar el texto.");
                }
              }}
            >
              Copiar texto
            </button>
          </div>
          <p className="muted">
            Si Instagram no aparece entre las opciones, descarga las imágenes y
            súbelas desde Instagram. Exportar no publica automáticamente ni
            modifica los accesos. Revocar un enlace no retira las copias ya
            subidas a una red social.
          </p>
        </>
      )}
      {snapshot && (
        <div className="social-export" ref={capture} aria-hidden="true">
          <Letter {...snapshot} />
        </div>
      )}
    </section>
  );
}
