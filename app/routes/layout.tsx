import { NavLink, Outlet } from "react-router";

const links = [
  { to: "/", label: "Workout" },
  { to: "/workouts", label: "History" },
  { to: "/exercises", label: "Exercises" },
  { to: "/plans", label: "Plans" },
  { to: "/gut", label: "Gut Log" },
  { to: "/food", label: "Food Log" },
];

export default function Layout() {
  return (
    <div className="min-h-screen text-gray-900 dark:text-gray-100">
      <nav className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="mx-auto max-w-3xl px-4 flex gap-1 overflow-x-auto">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `whitespace-nowrap px-3 py-3 text-sm font-medium border-b-2 ${
                  isActive
                    ? "border-blue-600 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
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
