import Link from "next/link";
export default function NotFound() {
  return (
    <main className="setup-panel">
      <p className="eyebrow">PÁGINA NO DISPONIBLE</p>
      <h1>Esta página no está aquí</h1>
      <p>
        El enlace pudo ser revocado, el texto retirado o el acceso restringido.
      </p>
      <Link className="button primary" href="/">
        Volver a Escritura Creativa
      </Link>
    </main>
  );
}
