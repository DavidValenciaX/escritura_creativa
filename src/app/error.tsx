"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="setup-panel">
      <h1>No pudimos abrir esta página</h1>
      <p>
        Revisa tu conexión o la configuración de Supabase. Tus borradores
        locales permanecen en este navegador.
      </p>
      <button className="button primary" onClick={reset}>
        Volver a intentar
      </button>
    </main>
  );
}
