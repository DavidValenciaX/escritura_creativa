"use client";
import Link from "next/link";
import { useState } from "react";
import { api, ErrorMessage } from "./ui";
type Report = {
  id: string;
  document_id: string | null;
  resource_id: string | null;
  reason: string;
  created_at: string;
  name: string;
};
export function Moderation({ initial }: { initial: Report[] }) {
  const [reports, setReports] = useState(initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  async function action(report: Report, hide: boolean) {
    setBusy(report.id);
    setError("");
    try {
      if (hide)
        await api("moderate", {
          action: report.resource_id ? "hideResource" : "hideText",
          id: report.resource_id ?? report.document_id,
        });
      await api("moderate", { action: "resolve", id: report.id });
      setReports((prev) => prev.filter((r) => r.id !== report.id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  return (
    <section>
      <div className="page-heading">
        <div>
          <h1>Moderación</h1>
          <p>
            Revisa los reportes y retira del catálogo o del muro lo que
            corresponda.
          </p>
        </div>
      </div>
      <ErrorMessage message={error} />
      {reports.map((r) => (
        <article className="admin-item" key={r.id}>
          <p className="eyebrow">
            {r.resource_id ? "RECURSO" : "TEXTO"} ·{" "}
            {new Date(r.created_at).toLocaleDateString("es-CO", {
              timeZone: "America/Bogota",
            })}
          </p>
          <h3>{r.name}</h3>
          <p>{r.reason}</p>
          <div className="actions">
            {r.document_id && (
              <Link className="button" href={`/text/${r.document_id}`}>
                Ver texto
              </Link>
            )}
            {r.resource_id && (
              <a
                className="button"
                href={`/api/resource/${r.resource_id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Ver archivo
              </a>
            )}
            <button
              className="button primary"
              disabled={busy === r.id}
              onClick={() => void action(r, true)}
            >
              Ocultar y resolver
            </button>
            <button
              className="button"
              disabled={busy === r.id}
              onClick={() => void action(r, false)}
            >
              Resolver sin ocultar
            </button>
          </div>
        </article>
      ))}
      {!reports.length && (
        <div className="empty-state">
          <h2>Sin reportes pendientes</h2>
        </div>
      )}
    </section>
  );
}
