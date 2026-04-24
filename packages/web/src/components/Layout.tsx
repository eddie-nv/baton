import { Link, NavLink, Outlet } from "react-router-dom";

export function Layout(): JSX.Element {
  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      <StatusStrip />
      <header className="border-b border-edge bg-canvas/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-6 py-3">
          <Link to="/" className="flex items-baseline gap-3 group">
            <span className="font-mono text-base font-semibold text-ink-50 tracking-tight group-hover:text-signal transition">
              baton
            </span>
            <span className="hidden sm:inline font-mono text-2xs uppercase tracking-widest text-ink-500">
              state fabric for coding agents
            </span>
          </Link>
          <nav className="flex items-center gap-1">
            <NavItem to="/" end={true}>Home</NavItem>
            <NavItem to="/dashboard" end={false}>Dashboard →</NavItem>
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-edge mt-16">
        <div className="mx-auto max-w-6xl flex flex-wrap items-center justify-between gap-3 px-6 py-5 font-mono text-2xs uppercase tracking-widest text-ink-500">
          <span>baton — git moves code, baton moves working state</span>
          <a
            href="https://github.com/eddie-nv/baton"
            className="hover:text-signal transition"
            target="_blank"
            rel="noreferrer"
          >
            github ↗
          </a>
        </div>
      </footer>
    </div>
  );
}

function StatusStrip(): JSX.Element {
  return (
    <div className="border-b border-edge bg-canvas-inset">
      <div className="mx-auto max-w-6xl flex flex-wrap items-center justify-between gap-3 px-6 py-1.5 font-mono text-2xs uppercase tracking-widest text-ink-500">
        <span className="flex items-center gap-2">
          <span className="live-dot" />
          <span className="text-ink-300">live</span>
          <span className="hidden sm:inline">· redis · streams · pub/sub</span>
        </span>
        <span className="hidden md:inline">
          ≤ 500 tok feature card · ≤ 1500 tok resume packet
        </span>
      </div>
    </div>
  );
}

interface NavItemProps {
  to: string;
  end?: boolean;
  children: React.ReactNode;
}

function NavItem({ to, end, children }: NavItemProps): JSX.Element {
  return (
    <NavLink
      to={to}
      end={end ?? false}
      className={({ isActive }) =>
        `px-2.5 py-1 font-mono text-2xs uppercase tracking-widest transition ${
          isActive ? "text-signal" : "text-ink-300 hover:text-ink-50"
        }`
      }
    >
      {children}
    </NavLink>
  );
}
