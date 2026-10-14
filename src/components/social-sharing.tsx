"use client";
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { api, ErrorMessage } from "./ui";
import { Letter } from "./letter";
import type { Draft } from "@/lib/model";
type Export = { title: string; text: string; images: string[] };
export function SocialSharing({ documentId }: { documentId: string }) {
  const [result, setResult] = useState<Export | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [fullImages, setFullImages] = useState<string[]>([]);
  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setFullImages(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [snapshot, setSnapshot] = useState<Draft | null>(null);
  const capture = useRef<HTMLDivElement>(null);
  return (
    <section className="sharing-section">
      <h3>Imagen</h3>
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
              document: Draft;
            }>("share-images", { documentId });
            flushSync(() => setSnapshot(data.document));
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
                    `escrito-${i + 1}.png`,
                    { type: "image/png" },
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
        {busy ? "Preparando imágenes…" : "Preparar imágenes"}
      </button>
      <ErrorMessage message={error} />
      {message && <p role="status">{message}</p>}
      {result && (
        <>
          <p>
            {result.images.length}{" "}
            {result.images.length === 1 ? "imagen" : "imágenes"}
          </p>
          <div className="social-cards">
            {result.images.map((src, i) => (
              <figure key={i}>
                <a
                  href={fullImages[i]}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Ver imagen ${i + 1} a tamaño completo`}
                >
                  <img
                    src={src}
                    alt={`Imagen ${i + 1} de ${result.title}`}
                    width={320}
                    height={400}
                  />
                </a>
                <figcaption>
                  <a
                    className="text-button"
                    href={src}
                    download={`escrito-${i + 1}.png`}
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
                      "Descarga las imágenes y compártelas desde la aplicación que prefieras.",
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
