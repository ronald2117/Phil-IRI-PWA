import { useEffect } from "react";
import { useLocation, NavLink, Outlet, Link } from "react-router-dom";
import { BookOpenCheck, Clock3, LayoutDashboard, Plus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";

interface NavigationItem {
  to: string;
  label: string;
  Icon: LucideIcon;
  end?: boolean;
}

const navigation: NavigationItem[] = [
  { to: "/", label: "Dashboard", Icon: LayoutDashboard, end: true },
  { to: "/new-assessment", label: "New assessment", Icon: Plus },
  { to: "/assessments", label: "Assessment history", Icon: Clock3 },
];

function isCurrentPath(pathname: string, item: NavigationItem) {
  if (item.end) return pathname === item.to;
  if (item.to === "/assessments") return pathname.startsWith("/assessments");
  return pathname === item.to;
}

function NavigationLink({ item, mobile = false }: { item: NavigationItem; mobile?: boolean }) {
  const { pathname } = useLocation();
  const active = isCurrentPath(pathname, item);
  const Icon = item.Icon;

  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={`navigation-link${active ? " navigation-link--active" : ""}${mobile ? " navigation-link--mobile" : ""}`}
      aria-current={active ? "page" : undefined}
    >
      <Icon size={19} strokeWidth={active ? 2.1 : 1.8} aria-hidden="true" />
      <span>{item.label}</span>
    </NavLink>
  );
}

export function AppShell() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [pathname]);

  return (
    <div className="app-shell">
      <aside className="desktop-sidebar">
        <Link className="sidebar-brand" to="/" aria-label="BasaBantay dashboard">
          <BrandMark />
        </Link>
        <div className="sidebar-rule" />
        <p className="sidebar-label">TEACHER SPACE</p>
        <nav className="sidebar-navigation" aria-label="Main navigation">
          {navigation.map((item) => <NavigationLink key={item.to} item={item} />)}
        </nav>
        <div className="sidebar-bottom">
          <span className="sidebar-book" aria-hidden="true"><BookOpenCheck size={20} /></span>
          <p>Listen with care.<br /><span>Every reader has a story.</span></p>
          <span className="sidebar-bottom-mark" aria-hidden="true">BB</span>
        </div>
      </aside>

      <div className="mobile-topbar">
        <BrandMark compact />
        <span className="mobile-topbar-context">TEACHER WORKSPACE</span>
      </div>

      <main className="main-panel">
        <header className="topbar">
          <div className="topbar-breadcrumb">
            <span className="topbar-dot" />
            <span>TEACHER WORKSPACE</span>
          </div>
          <div className="topbar-right">
            <span className="topbar-date">{new Intl.DateTimeFormat("en-PH", { weekday: "long", month: "long", day: "numeric" }).format(new Date())}</span>
            <span className="teacher-avatar" aria-label="Teacher profile">T</span>
          </div>
        </header>
        <div className="page-container" key={pathname}>
          <Outlet />
        </div>
      </main>

      <nav className="mobile-navigation" aria-label="Main navigation">
        {navigation.map((item) => <NavigationLink key={item.to} item={item} mobile />)}
      </nav>
    </div>
  );
}