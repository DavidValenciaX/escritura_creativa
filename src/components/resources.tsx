"use client";
import Link from "next/link";
import { useState } from "react";
import { Search, Plus, ArrowUpRight, Trash2 } from "lucide-react";
import { family, type Resource } from "@/lib/model";
import { ErrorMessage, Modal, ReportButton } from "./ui";
function Preview({ resource: r }: { resource: Resource }) {
  return (
    <div
      className={`resource-preview ${r.kind === "paper" && r.builtin_key ? `paper-${r.builtin_key}` : ""}`}
      style={
        r.kind === "paper" && !r.builtin_key
          ? {
              backgroundImage: `url(/api/resource/${r.id})`,
              backgroundSize: "cover",
            }
          : {}
      }
    >
      {r.kind === "font" ? (
        <>
          {!r.builtin_key && (
            <style>{`@font-face{font-family:"resource-${r.id}";src:url("/api/resource/${r.id}") format("woff2");font-display:swap;}`}</style>
          )}
          <span
            className="font-sample"
            style={{ fontFamily: `"${family(r.builtin_key ?? r.id)}",serif` }}
          >
            Aa Bb Cc
            <br />
            0123456789
          </span>
          <small>Á É Í Ó Ú · Ñ · ¿ ¡</small>
        </>
      ) : r.kind === "image" ? (
        <img src={`/api/resource/${r.id}`} alt={r.description || r.name} />
      ) : (
        <>
          <span className="sample-script">Muestra de texto</span>
          <small>{r.name.toUpperCase()}</small>
        </>
      )}
    </div>
  );
}
export function ResourceLibrary({
  initial,
  connected,
  userId,
}: {
  initial: Resource[];
  connected: boolean;
  userId: string | null;
}) {
  const [resources, setResources] = useState(initial);
  const [kind, setKind] = useState("paper");
  const [search, setSearch] = useState("");
  const [upload, setUpload] = useState(false);
  const [detail, setDetail] = useState<Resource | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [license, setLicense] = useState("CC0");
  const [deleteError, setDeleteError] = useState("");
  const visible = resources.filter(
    (r) =>
      (kind === "all" || r.kind === kind) &&
      `${r.name} ${r.author} ${r.description} ${r.tags.join(" ")}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  async function contribute(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    form.set("mode", "resource");
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: form,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setResources((prev) => [
        {
          id: data.id,
          owner_id: userId,
          kind: form.get("kind") as Resource["kind"],
          name: String(form.get("name")),
          author: String(form.get("author") ?? "").trim(),
          source: String(form.get("source") ?? "").trim(),
          license: String(form.get("license")),
          description: String(form.get("description") ?? ""),
          tags: String(form.get("tags") ?? "")
            .split(",")
            .filter(Boolean),
          builtin_key: null,
          hidden: false,
        },
        ...prev,
      ]);
      setUpload(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(resource: Resource) {
    if (
      !window.confirm(
        `¿Eliminar «${resource.name}» de la biblioteca? Seguirá disponible en los textos que ya lo usan.`,
      )
    )
      return;
    setBusy(true);
    setDeleteError("");
    try {
      const response = await fetch(`/api/resource/${resource.id}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setResources((prev) => prev.filter((r) => r.id !== resource.id));
      setDetail(null);
    } catch (e) {
      setDeleteError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function apply(resource: Resource) {
    if (connected) return;
    try {
      sessionStorage.setItem(
        "ec:apply-resource",
        resource.builtin_key ?? resource.id,
      );
    } catch {}
  }
  return (
    <section>
      <div className="page-heading">
        <div>
          <h1>Biblioteca de recursos</h1>
          <p>Papeles, tipografías e imágenes para aplicar a tus textos.</p>
        </div>
        {userId && connected ? (
          <button className="button primary" onClick={() => setUpload(true)}>
            <Plus size={17} /> Aportar un recurso
          </button>
        ) : (
          <Link className="button" href={connected ? "/login" : "/studio"}>
            <Plus size={17} /> Aportar un recurso
          </Link>
        )}
      </div>
      {!connected && (
        <div className="notice">
          Estos 16 recursos vienen incluidos en la aplicación. Los aportes
          comunitarios estarán disponibles al conectar Supabase.
        </div>
      )}
      <div className="toolbar-row">
        <div className="tabs" role="group" aria-label="Tipo de recurso">
          {[
            ["paper", "Papeles"],
            ["font", "Tipografías"],
            ["image", "Imágenes"],
            ["all", "Todos"],
          ].map(([value, label]) => (
            <button
              key={value}
              className={kind === value ? "selected" : ""}
              onClick={() => setKind(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="search-field">
          <Search size={17} />
          <input
            aria-label="Buscar recursos"
            placeholder="Buscar recursos"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      <div className="resource-grid">
        {visible.map((r) => (
          <article className="resource-card" key={r.id}>
            <button
              style={{ width: "100%", background: "transparent" }}
              aria-label={`Ver ${r.name}`}
              onClick={() => {
                setDeleteError("");
                setDetail(r);
              }}
            >
              <Preview resource={r} />
            </button>
            <div className="resource-info">
              <h3>{r.name}</h3>
              <p>{r.description || (r.author ? `Por ${r.author}` : "")}</p>
              <footer>
                <span className="badge">{r.license}</span>
                {r.kind !== "image" ? (
                  <Link
                    className="text-button"
                    href={
                      connected ? `/studio?resource=${r.id}` : "/studio/preview"
                    }
                    onClick={() => apply(r)}
                  >
                    Usar en un texto <ArrowUpRight size={13} />
                  </Link>
                ) : (
                  <button
                    className="text-button"
                    onClick={() => {
                      setDeleteError("");
                      setDetail(r);
                    }}
                  >
                    Ver recurso <ArrowUpRight size={13} />
                  </button>
                )}
              </footer>
            </div>
          </article>
        ))}
        {!visible.length && (
          <div className="empty-state">
            <h2>
              {kind === "image"
                ? "No hay imágenes disponibles"
                : "No encontramos ese recurso"}
            </h2>
            <p>
              {kind === "image"
                ? "Las imágenes de la comunidad aparecerán aquí. Tus fotos personales permanecen dentro de tus textos."
                : "Prueba con otro nombre o categoría."}
            </p>
          </div>
        )}
      </div>
      {detail && (
        <Modal
          title={detail.name}
          onClose={() => {
            if (!busy) setDetail(null);
          }}
        >
          <Preview resource={detail} />
          <p className="muted" style={{ marginTop: 20 }}>
            {detail.description}
          </p>
          {detail.author && <p>Autoría: {detail.author}</p>}
          <p>Licencia: {detail.license}</p>
          {detail.source && (
            <p>
              Procedencia:{" "}
              {/^https?:\/\//.test(detail.source) ? (
                <a
                  href={detail.source}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-button"
                >
                  Consultar fuente <ArrowUpRight size={13} />
                </a>
              ) : (
                detail.source
              )}
            </p>
          )}
          {detail.kind !== "image" && (
            <Link
              className="button primary"
              href={
                connected ? `/studio?resource=${detail.id}` : "/studio/preview"
              }
              onClick={() => apply(detail)}
            >
              Usar en un texto
            </Link>
          )}
          {connected && (
            <div style={{ marginTop: 15 }}>
              <ReportButton resourceId={detail.id} />
            </div>
          )}
          {connected &&
            userId &&
            detail.owner_id === userId &&
            !detail.builtin_key && (
              <div style={{ marginTop: 15 }}>
                <ErrorMessage message={deleteError} />
                <button
                  className="button"
                  disabled={busy}
                  onClick={() => remove(detail)}
                >
                  <Trash2 size={17} />{" "}
                  {busy ? "Eliminando…" : "Eliminar recurso"}
                </button>
              </div>
            )}
        </Modal>
      )}
      {upload && (
        <Modal title="Aportar un recurso" onClose={() => setUpload(false)}>
          <form onSubmit={contribute}>
            <p className="muted">
              Tu aporte aparecerá inmediatamente en la biblioteca. Comparte solo
              archivos que permitan su reutilización.
            </p>
            <div className="form-grid">
              <label>
                Tipo
                <select
                  name="kind"
                  defaultValue={
                    kind === "font"
                      ? "font"
                      : kind === "image"
                        ? "image"
                        : "paper"
                  }
                >
                  <option value="paper">Papel o textura</option>
                  <option value="font">Tipografía WOFF2</option>
                  <option value="image">Imagen</option>
                </select>
              </label>
              <label>
                Nombre
                <input name="name" required maxLength={120} />
              </label>
            </div>
            <label>
              Archivo
              <input
                name="file"
                required
                type="file"
                accept="image/jpeg,image/png,image/webp,.woff2"
              />
            </label>
            <p className="muted">
              JPEG, PNG y WebP hasta 10 MB. WOFF2 hasta 2 MB.
            </p>
            <div className="form-grid">
              <label>
                Autoría
                <input
                  name="author"
                  required={license !== "CC0"}
                  maxLength={160}
                  placeholder={
                    license === "CC0"
                      ? "Opcional para dominio público"
                      : undefined
                  }
                />
              </label>
              <label>
                Licencia
                <select
                  name="license"
                  required
                  value={license}
                  onChange={(e) => setLicense(e.target.value)}
                >
                  <option value="CC0">CC0 · dominio público</option>
                  <option value="CC-BY-4.0">CC BY 4.0 · con atribución</option>
                  <option value="OFL-1.1">OFL 1.1 · tipografías</option>
                  <option value="Apache-2.0">Apache 2.0</option>
                </select>
              </label>
            </div>
            <label>
              Procedencia
              <input
                name="source"
                required={license !== "CC0"}
                maxLength={500}
                placeholder={
                  license === "CC0"
                    ? "Opcional: URL original o «Creación propia»"
                    : "URL original o «Creación propia»"
                }
              />
            </label>
            <label>
              Descripción
              <textarea
                name="description"
                maxLength={1000}
                placeholder="Opcional"
              />
            </label>
            <label>
              Etiquetas separadas por comas
              <input name="tags" placeholder="vintage, cálido, manuscrita" />
            </label>
            <label className="checkbox-label">
              <input name="permission" value="yes" type="checkbox" required />{" "}
              Tengo permiso para compartir este archivo con la licencia
              indicada.
            </label>
            <ErrorMessage message={error} />
            <button className="button primary" disabled={busy}>
              {busy ? "Subiendo…" : "Publicar recurso"}
            </button>
          </form>
        </Modal>
      )}
    </section>
  );
}
