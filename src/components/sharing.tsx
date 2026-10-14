"use client";
import { useEffect, useState } from "react";
import { Link as LinkIcon, Trash2, Copy, Globe, Mail } from "lucide-react";
import { api, Modal, ErrorMessage } from "./ui";
import { SocialSharing } from "./social-sharing";
type Target = { document_id: string | null; notebook_id: string | null };
type Grant = {
  id: string;
  document_id: string | null;
  notebook_id: string | null;
  recipient_email: string;
};
type SharedLink = {
  id: string;
  document_id: string | null;
  notebook_id: string | null;
  revoked_at: string | null;
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
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [isPublic, setPublic] = useState(false);
  const [published, setPublished] = useState(false);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [links, setLinks] = useState<SharedLink[]>([]);
  const [newLinks, setNewLinks] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  async function load() {
    const response = await fetch("/api/studio");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    const matches = (row: Target) =>
      target.document_id
        ? row.document_id === target.document_id
        : row.notebook_id === target.notebook_id;
    setGrants(data.grants.filter(matches));
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
          Los destinatarios y enlaces verán las entradas publicadas actuales y
          futuras de este cuaderno. Los borradores permanecen privados.
        </p>
      )}
      {target.document_id && published && (
        <SocialSharing documentId={target.document_id} />
      )}
      <section className="sharing-section">
        <h3>
          <Mail size={17} style={{ display: "inline", marginRight: 8 }} />
          Personas concretas
        </h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void action(async () => {
              await api("sharing", { action: "grant", ...target, email });
              setEmail("");
              setMessage(
                "Acceso concedido. La persona verá el contenido al entrar con ese correo.",
              );
            });
          }}
        >
          <label>
            Correo del destinatario
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="persona@correo.com"
            />
          </label>
          <button className="button" disabled={busy}>
            Conceder acceso
          </button>
        </form>
        <ul className="modal-list">
          {grants.map((g) => (
            <li key={g.id}>
              {g.recipient_email}
              <button
                aria-label={`Revocar acceso de ${g.recipient_email}`}
                className="icon-button"
                disabled={busy}
                onClick={() =>
                  void action(async () => {
                    await api("sharing", {
                      action: "revokeGrant",
                      ...target,
                      id: g.id,
                    });
                  })
                }
              >
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
        <p className="muted">
          No enviamos invitaciones por correo. Comparte el enlace de la
          aplicación con tu destinatario.
        </p>
      </section>
      <section className="sharing-section">
        <h3>
          <LinkIcon size={17} style={{ display: "inline", marginRight: 8 }} />
          Enlaces para compartir
        </h3>
        <p className="muted">
          Quien tenga un enlace podrá leer sin cuenta. Puedes revocarlo cuando
          quieras.
        </p>
        <button
          className="button"
          disabled={busy}
          onClick={() =>
            void action(async () => {
              const data = await api<{ id: string; url: string }>("sharing", {
                action: "link",
                ...target,
              });
              setNewLinks((prev) => ({ ...prev, [data.id]: data.url }));
            })
          }
        >
          Crear enlace
        </button>
        <ul className="modal-list">
          {links.map((l, i) => (
            <li key={l.id}>
              <div>
                {newLinks[l.id] ? (
                  <div className="link-result">{newLinks[l.id]}</div>
                ) : (
                  <span>
                    Enlace activo {i + 1} · {l.id.slice(0, 8)}
                  </span>
                )}
              </div>
              <div style={{ display: "flex" }}>
                {newLinks[l.id] && (
                  <button
                    className="text-button"
                    onClick={async () => {
                      setError("");
                      try {
                        if (navigator.share) {
                          await navigator.share({ title, url: newLinks[l.id] });
                          setMessage("Enlace enviado al menú de compartir.");
                        } else {
                          await navigator.clipboard.writeText(newLinks[l.id]);
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
                {newLinks[l.id] && (
                  <button
                    className="icon-button"
                    aria-label="Copiar enlace"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(newLinks[l.id]);
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
          ))}
        </ul>
        <p className="muted">
          Copia cada enlace al crearlo. Por seguridad no guardamos su dirección
          completa. Para regenerarlo, revoca el anterior y crea uno nuevo.
        </p>
      </section>
    </Modal>
  );
}
