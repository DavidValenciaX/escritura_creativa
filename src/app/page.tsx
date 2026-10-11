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
          <p className="eyebrow">PALABRAS QUE MERECEN SU PROPIO PAPEL</p>
          <h1>
            Hay cosas que solo
            <br />
            se dicen <em>escribiendo.</em>
          </h1>
          <p className="lead">
            Cartas, recuerdos, poemas. Un pequeño estudio para
            <br className="desktop-only" /> encontrar las palabras y darles un
            lugar donde quedarse.
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
          <span className="paper-note">Tu próxima historia empieza aquí</span>
          <Letter
            title="A las cosas pequeñas"
            written_on="2026-10-11"
            appearance={{
              ...defaultAppearance,
              bodyFont: "garamond",
              fontSize: 20,
            }}
            signature="Con cariño,"
            content={{
              type: "doc",
              content: [
                {
                  type: "paragraph",
                  content: [
                    {
                      type: "text",
                      text: "Hoy quiero escribir sobre lo que a veces pasa desapercibido. La luz que entra por la ventana. El café que se enfría mientras hablamos. Tu manera de decir mi nombre.",
                    },
                  ],
                },
                {
                  type: "paragraph",
                  content: [
                    {
                      type: "text",
                      text: "Quizá escribir sea eso: guardar un poco de lo que no queremos olvidar.",
                    },
                  ],
                },
              ],
            }}
          />
          <span className="specimen-label">
            Una carta de muestra · papel Marfil + Caveat
          </span>
        </div>
      </section>
      <section className="home-details">
        <div className="section-heading">
          <div>
            <p className="eyebrow">HECHO PARA ESCRIBIR, A TU MANERA</p>
            <h2>
              Las palabras son tuyas.
              <br />
              El espacio también.
            </h2>
          </div>
          <span className="small-rule" />
        </div>
        <div className="feature-grid">
          <Link href="/studio">
            <BookOpen size={24} />
            <span className="feature-number">01</span>
            <h3>Tu propio estudio</h3>
            <p>
              Ordena tus textos en cuadernos. Deja reposar un borrador y vuelve
              cuando tengas algo más que decir.
            </p>
            <span className="feature-link">
              Entrar al estudio <ArrowUpRight size={16} />
            </span>
          </Link>
          <Link href="/resources">
            <Library size={24} />
            <span className="feature-number">02</span>
            <h3>Papeles con carácter</h3>
            <p>
              Elige una textura y una letra. Explora una biblioteca de recursos
              que crece con cada escritor.
            </p>
            <span className="feature-link">
              Explorar la biblioteca <ArrowUpRight size={16} />
            </span>
          </Link>
          <Link href="/wall">
            <Feather size={24} />
            <span className="feature-number">03</span>
            <h3>Algo para compartir</h3>
            <p>
              Una carta para alguien. Un enlace para unos pocos. O unas palabras
              abiertas al mundo. Tú decides.
            </p>
            <span className="feature-link">
              Leer a otros escritores <ArrowUpRight size={16} />
            </span>
          </Link>
        </div>
      </section>
      <footer className="page-footer">
        <span>ESCRITURA CREATIVA</span>
        <span>Sin prisa. Sin ruido. Con palabras.</span>
        <Feather size={16} />
      </footer>
    </Shell>
  );
}
