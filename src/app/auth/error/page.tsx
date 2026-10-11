import Link from "next/link";
import { Shell } from "@/components/shell";
export default function Page() {
  return (
    <Shell>
      <section className="setup-panel">
        <h1>El enlace ya no es válido</h1>
        <p>
          Solicita un nuevo enlace y ábrelo en el mismo navegador donde lo
          pediste.
        </p>
        <Link className="button primary" href="/login">
          Volver a iniciar sesión
        </Link>
      </section>
    </Shell>
  );
}
