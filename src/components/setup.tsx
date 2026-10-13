import Link from "next/link";
import { BookOpen, ArrowUpRight, Server } from "lucide-react";
export function Setup({ title = "Conexión pendiente" }: { title?: string }) {
  return (
    <section className="setup-panel">
      <div className="setup-icon">
        <Server size={28} />
      </div>
      <p className="eyebrow">CONFIGURACIÓN PENDIENTE</p>
      <h1>{title}</h1>
      <p>
        Esta instalación todavía no tiene un proyecto Supabase conectado. Las
        cuentas, publicaciones y archivos compartidos necesitan esa conexión.
      </p>
      <ol>
        <li>Ejecuta las migraciones y el catálogo inicial en Supabase.</li>
        <li>
          Completa las variables de <code>.env.local</code> con las claves del
          proyecto.
        </li>
        <li>Configura las URLs de autenticación y reinicia la aplicación.</li>
      </ol>
      <p className="muted">
        Las instrucciones completas están en el README del proyecto.
      </p>
      <Link className="button primary" href="/studio/preview">
        <BookOpen size={17} /> Probar el editor local <ArrowUpRight size={17} />
      </Link>
    </section>
  );
}
export function SignInRequired() {
  return (
    <section className="setup-panel">
      <BookOpen size={28} />
      <h1>Inicia sesión para continuar</h1>
      <p>
        Inicia sesión para guardar textos, organizar cuadernos y gestionar el
        acceso a tus publicaciones.
      </p>
      <Link href="/login" className="button primary">
        Iniciar sesión <ArrowUpRight size={17} />
      </Link>
    </section>
  );
}
