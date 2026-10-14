"use client";
import { useEffect, useState } from "react";
import { Link as LinkIcon, Trash2, Copy, Globe } from "lucide-react";
import { api, Modal, ErrorMessage } from "./ui";
import { SocialSharing } from "./social-sharing";
type Target = { document_id: string | null; notebook_id: string | null };
type SharedLink = {
  id: string;
  document_id: string | null;
  notebook_id: string | null;
  revoked_at: string | null;
  url: string | null;
};
export function Sharing({
  target,
  title,
  revision,
  onClose,
  onPublished,
}: {
  target: Target;
  title: string;
  revision?: number;
  onClose: () => void;
  onPublished?: () => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [isPublic, setPublic] = useState(false);
  const [published, setPublished] = useState(false);
  const [links, setLinks] = useState<SharedLink[]>([]);
  const [message, setMessage] = useState("");
  async function load() {
    const response = await fetch("/api/studio");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    const matches = (row: Target) =>
      target.document_id
        ? row.document_id === target.document_id
        : row.notebook_id === target.notebook_id;
    setLinks(data.links.filter((l: SharedLink) => matches(l) && !l.revoked_at));
    const pub = data.publications.find(
      (p: { document_id: string }) => p.document_id === target.document_id,
    );
    setPublic(pub?.is_public ?? false);
    setPublished(!!pub);
  }
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, []);
  async function action(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Publicar y compartir" onClose={onClose}>
      <p className="muted">{title}</p>
      <ErrorMessage message={error} />
      {message && (
        <p className="success-message" role="status">
          {message}
        </p>
      )}
      {target.document_id && (
        <section className="sharing-section">
          <h3>
            <Globe size={17} style={{ display: "inline", marginRight: 8 }} />
            Versión de lectura
          </h3>
          <p className="muted">
            Los cambios de tu borrador solo se comparten cuando actualizas esta
            versión.
          </p>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setPublic(e.target.checked)}
            />{" "}
            Mostrar también en el muro público
          </label>
          <button
            className="button primary"
            disabled={busy}
            onClick={() =>
              void action(async () => {
                await api("publish", {
                  id: target.document_id,
                  revision,
                  is_public: isPublic,
                });
                setMessage("La versión de lectura está actualizada.");
                onPublished?.();
              })
            }
          >
            {published
              ? "Actualizar versión publicada"
              : "Publicar versión de lectura"}
          </button>
          {published && (
            <button
              className="text-button"
              style={{ marginLeft: 15 }}
              disabled={busy}
              onClick={() =>
                void action(async () => {
                  await api("publish", {
                    action: "unpublish",
                    id: target.document_id,
                  });
                  onPublished?.();
                  setMessage("La versión de lectura fue retirada.");
                })
              }
            >
              Retirar publicación
            </button>
          )}
        </section>
      )}
      {!target.document_id && (
        <p className="notice">
          Los enlaces permiten leer las entradas publicadas actuales y futuras
          de este cuaderno. Los borradores permanecen privados.
        </p>
      )}
      {target.document_id && <SocialSharing documentId={target.document_id} />}
      <section className="sharing-section">
        <h3>
          <LinkIcon size={17} style={{ display: "inline", marginRight: 8 }} />
          Enlaces para compartir
        </h3>
        <p className="muted">
          Los enlaces son cortos y permiten leer sin cuenta. Puedes revocarlos
          cuando quieras.
        </p>
        <button
          className="button"
          disabled={busy}
          onClick={() =>
            void action(async () => {
              await api("sharing", {
                action: "link",
                ...target,
              });
            })
          }
        >
          Crear enlace
        </button>
        <ul className="modal-list shared-links-list">
          {links.map((l, i) => {
            const url = l.url;
            return (
              <li key={l.id}>
                <div>
                  {url ? (
                    <div className="link-result">{url}</div>
                  ) : (
                    <span>
                      Enlace activo {i + 1} · {l.id.slice(0, 8)}
                    </span>
                  )}
                </div>
                <div className="shared-link-actions">
                  {url && (
                    <button
                      className="text-button"
                      onClick={async () => {
                        setError("");
                        try {
                          if (navigator.share) {
                            await navigator.share({ title, url });
                            setMessage("Enlace enviado al menú de compartir.");
                          } else {
                            await navigator.clipboard.writeText(url);
                            setMessage(
                              "Enlace copiado. Pégalo en Facebook, WhatsApp u otra aplicación.",
                            );
                          }
                        } catch (e) {
                          if ((e as Error).name !== "AbortError")
                            setError(
                              "No se pudo compartir. Puedes copiar el enlace mostrado.",
                            );
                        }
                      }}
                    >
                      Compartir enlace
                    </button>
                  )}
                  {url && (
                    <button
                      className="icon-button"
                      aria-label="Copiar enlace"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(url);
                          setMessage("Enlace copiado.");
                        } catch {
                          setError("Copia el enlace mostrado manualmente.");
                        }
                      }}
                    >
                      <Copy size={15} />
                    </button>
                  )}
                  <button
                    className="icon-button"
                    aria-label="Revocar enlace"
                    disabled={busy}
                    onClick={() =>
                      void action(async () => {
                        await api("sharing", {
                          action: "revokeLink",
                          ...target,
                          id: l.id,
                        });
                      })
                    }
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="muted">
          Tus enlaces activos se guardan aquí para que puedas volver a copiarlos
          o compartirlos cuando lo necesites.
        </p>
      </section>
    </Modal>
  );
}
