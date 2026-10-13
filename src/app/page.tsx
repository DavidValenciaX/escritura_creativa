import Link from "next/link";
import {
  ArrowUpRight,
  Feather,
  Library,
  BookOpen,
  ArrowRight,
} from "lucide-react";
import { Shell } from "@/components/shell";
import { Letter } from "@/components/letter";
import { defaultAppearance } from "@/lib/model";
export default function Home() {
  return (
    <Shell active="/studio">
      <section className="welcome-heading">
        <div>
          <h1>Escritura Creativa</h1>
          <p className="lead">
            Escribe y organiza tus textos en cuadernos, personaliza su formato y
            comparte versiones de lectura.
          </p>
          <div className="hero-actions">
            <Link href="/studio" className="button primary">
              Abrir mi estudio <ArrowUpRight size={17} />
            </Link>
            <Link href="/studio/preview" className="text-button">
              Probar el editor <ArrowRight size={17} />
            </Link>
          </div>
        </div>
        <div className="hero-paper-wrap">
          <Letter
            title="Texto de ejemplo"
            written_on="2026-10-11"
            appearance={{
              ...defaultAppearance,
              bodyFont: "garamond",
              fontSize: 20,
            }}
            signature=""
            content={{
              type: "doc",
              content: [
                {
                  type: "paragraph",
                  content: [
                    {
                      type: "text",
                      text: "Este texto muestra el formato de una página con papel Marfil, título en Caveat y cuerpo en EB Garamond.",
                    },
                  ],
                },
                {
                  type: "paragraph",
                  content: [
                    {
                      type: "text",
                      text: "En el editor puedes cambiar el papel, las tipografías, el tamaño de letra y el interlineado.",
                    },
                  ],
                },
              ],
            }}
          />
          <span className="specimen-label">
            Ejemplo de formato · Marfil, Caveat y EB Garamond
          </span>
        </div>
      </section>
      <section className="home-details">
        <div className="section-heading">
          <div>
            <h2>Herramientas de escritura</h2>
          </div>
          <span className="small-rule" />
        </div>
        <div className="feature-grid">
          <Link href="/studio">
            <BookOpen size={24} />
            <span className="feature-number">01</span>
            <h3>Textos y cuadernos</h3>
            <p>Crea borradores y organiza tus textos en cuadernos.</p>
            <span className="feature-link">
              Entrar al estudio <ArrowUpRight size={16} />
            </span>
          </Link>
          <Link href="/resources">
            <Library size={24} />
            <span className="feature-number">02</span>
            <h3>Recursos de formato</h3>
            <p>Selecciona papeles, tipografías e imágenes para tus textos.</p>
            <span className="feature-link">
              Explorar la biblioteca <ArrowUpRight size={16} />
            </span>
          </Link>
          <Link href="/wall">
            <Feather size={24} />
            <span className="feature-number">03</span>
            <h3>Publicación y acceso</h3>
            <p>
              Comparte textos por enlace, concede acceso a personas o publica en
              el muro de escritores.
            </p>
            <span className="feature-link">
              Leer a otros escritores <ArrowUpRight size={16} />
            </span>
          </Link>
        </div>
      </section>
      <footer className="page-footer">
        <span>ESCRITURA CREATIVA</span>
        <Feather size={16} />
      </footer>
    </Shell>
  );
}
