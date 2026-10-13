import Link from "next/link";
import {
  Feather,
  BookOpen,
  Library,
  Globe,
  Inbox,
  Heart,
  ArrowUpRight,
  Settings,
  Shield,
} from "lucide-react";
import { configured, session, supabase } from "@/lib/supabase/server";
import type { ReactNode } from "react";
export async function Shell({
  children,
  active,
}: {
  children: ReactNode;
  active?: string;
}) {
  const user = await session();
  let admin = false;
  if (user) {
    const db = await supabase();
    const { data } = await db.rpc("is_admin");
    admin = !!data;
  }
  const items = [
    { href: "/studio", label: "Mi estudio", short: "Estudio", icon: BookOpen },
    {
      href: "/resources",
      label: "Biblioteca de recursos",
      short: "Recursos",
      icon: Library,
    },
    { href: "/wall", label: "Muro de escritores", short: "Muro", icon: Globe },
    {
      href: "/received",
      label: "Compartido conmigo",
      short: "Recibidos",
      icon: Inbox,
    },
    {
      href: "/favorites",
      label: "Mis favoritos",
      short: "Favoritos",
      icon: Heart,
    },
  ];
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="brand" href="/">
          <span className="brand-mark">
            <Feather size={23} />
          </span>
          <span>
            escritura<span className="brand-sub">CREATIVA</span>
          </span>
        </Link>
        <Link className="account-link" href={user ? "/settings" : "/login"}>
          {user ? (
            <>
              <span className="avatar">
                {(user.email ?? "E")[0].toUpperCase()}
              </span>{" "}
              Mi cuenta
            </>
          ) : (
            <>
              Entrar al estudio <ArrowUpRight size={16} />
            </>
          )}
        </Link>
      </header>
      <div className="app-body">
        <aside className="sidebar">
          <nav aria-label="Principal">
            {items.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={active === href ? "nav-item active" : "nav-item"}
              >
                <Icon size={19} />
                {label}
                {active === href && <span className="nav-dot" />}
              </Link>
            ))}
          </nav>
          <div className="sidebar-bottom">
            {user && (
              <Link className="nav-item" href="/settings">
                <Settings size={18} /> Ajustes del perfil
              </Link>
            )}
            {admin && (
              <Link className="nav-item" href="/admin">
                <Shield size={18} /> Moderación
              </Link>
            )}
            <div className="connection">
              <span
                className={configured() ? "status-dot" : "status-dot amber"}
              />
              {configured()
                ? "Conectado"
                : "Vista local · sin conexión a Supabase"}
            </div>
          </div>
        </aside>
        <main className="main-content">{children}</main>
      </div>
      <nav
        className="mobile-navigation screen-only"
        aria-label="Navegación móvil"
      >
        {items.map(({ href, short, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={active === href ? "active" : ""}
          >
            <Icon size={19} />
            <span>{short}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
