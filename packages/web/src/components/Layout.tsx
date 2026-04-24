import { Link, NavLink, Outlet } from "react-router-dom";

export function Layout(): JSX.Element {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-ink-200 bg-white">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2 group">
            <span className="text-2xl font-bold tracking-tight text-ink-900 group-hover:text-accent transition">
              baton
            </span>
            <span className="hidden sm:inline text-xs font-mono text-ink-500">
              state fabric for coding agents
            </span>
          </Link>
          <nav className="flex items-center gap-1">
            <NavItem to="/" end>Home</NavItem>
            <NavItem to="/dashboard">Dashboard</NavItem>
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-ink-200 bg-white">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-6 py-4 text-xs text-ink-500">
          <span>baton — git moves your code, baton passes the why</span>
          <a
            href="https://github.com/eddie-nv/baton"
            className="hover:text-ink-900 transition"
            target="_blank"
            rel="noreferrer"
          >
            github
          </a>
        </div>
      </footer>
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
        `px-3 py-1.5 text-sm rounded-md transition ${
          isActive
            ? "bg-ink-100 text-ink-900"
            : "text-ink-500 hover:text-ink-900"
        }`
      }
    >
      {children}
    </NavLink>
  );
}
