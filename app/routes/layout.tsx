import { NavLink, Outlet } from "react-router";

const links = [
  { to: "/", label: "Food" },
  { to: "/workouts", label: "Workouts" },
  { to: "/gut", label: "Gut" },
];

export default function Layout() {
  return (
    <div className="min-h-screen">
      <nav className="border-b bg-card">
        <div className="mx-auto max-w-3xl px-4 flex gap-1 overflow-x-auto">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `whitespace-nowrap px-3 py-3 text-sm font-medium border-b-2 ${
                  isActive
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </div>
      </nav>
      <main className="mx-auto max-w-3xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
