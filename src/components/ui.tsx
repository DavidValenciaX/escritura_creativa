"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { X, ArrowUpRight } from "lucide-react";
export async function api<T = Record<string, unknown>>(
  path: string,
  body: unknown,
): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error ?? "No se pudo completar la operación.");
  return data;
}
export function Modal({
  title,
  children,
  onClose,
  presentation = "dialog",
  restoreFocus,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  presentation?: "dialog" | "editor";
  restoreFocus?: () => void;
}) {
  const root = useRef<HTMLElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const restore = useRef(restoreFocus);
  restore.current = restoreFocus;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    root.current
      ?.querySelector<HTMLElement>("input,textarea,select,button")
      ?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close.current();
      }
      if (e.key === "Tab") {
        const list = Array.from(
          root.current?.querySelectorAll<HTMLElement>(
            'a[href],button:not([disabled]),input:not([disabled]),textarea,select,[tabindex="0"]',
          ) ?? [],
        );
        const first = list[0],
          last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = priorOverflow;
      if (restore.current) restore.current();
      else if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  return (
    <div
      className={`modal-backdrop ${presentation === "editor" ? "editor-panel-backdrop" : ""}`}
      onClick={onClose}
    >
      <section
        ref={root}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <header>
          <h2>{title}</h2>
          <button className="icon-button" aria-label="Cerrar" onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
export function ErrorMessage({ message }: { message: string }) {
  return message ? (
    <p role="alert" className="error-message">
      {message}
    </p>
  ) : null;
}
export function ReportButton({
  documentId,
  resourceId,
  token,
}: {
  documentId?: string;
  resourceId?: string;
  token?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  return (
    <>
      <button className="text-button" onClick={() => setOpen(true)}>
        {sent ? "Reporte enviado" : "Reportar"}
      </button>
      {open && (
        <Modal title="Reportar contenido" onClose={() => setOpen(false)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                await api("reports", {
                  reason,
                  document_id: documentId ?? null,
                  resource_id: resourceId ?? null,
                  token,
                });
                setSent(true);
                setOpen(false);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Cuéntanos qué debemos revisar
              <textarea
                required
                minLength={5}
                maxLength={1000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <p className="muted">
              Necesitas iniciar sesión para enviar un reporte.
            </p>
            <ErrorMessage message={error} />
            <button className="button primary" disabled={busy}>
              Enviar reporte <ArrowUpRight size={16} />
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
