import { useEffect } from "react";
import { NavLink, Outlet, useRevalidator } from "react-router";
import {
  TZ_COOKIE,
  browserTimeZone,
  requestTimeZone,
  writeTimeZoneCookie,
} from "~/lib/ui";
import type { Route } from "./+types/layout";

const links = [
  { to: "/", label: "Food" },
  { to: "/workouts", label: "Workouts" },
  { to: "/gut", label: "Gut" },
];

// The zone the server used for this render, so the client can tell whether
// its own zone has been picked up yet.
export async function loader({ request }: Route.LoaderArgs) {
  return { timeZone: requestTimeZone(request) };
}

export default function Layout({ loaderData }: Route.ComponentProps) {
  const { timeZone } = loaderData;
  const { revalidate } = useRevalidator();

  // Keep the tz cookie in sync with the browser's zone (it changes when
  // travelling), then re-run the loaders so "today" follows. Skip when the
  // cookie already holds the browser zone, so an unrecognised zone can't loop.
  useEffect(() => {
    const zone = browserTimeZone();
    if (!zone || zone === timeZone) return;
    if (document.cookie.includes(`${TZ_COOKIE}=${encodeURIComponent(zone)}`)) return;
    writeTimeZoneCookie(zone);
    revalidate();
  }, [timeZone, revalidate]);

  // A tab left open overnight still shows yesterday's "today": refresh the
  // loaders whenever the page comes back into view.
  useEffect(() => {
    const onReturn = () => {
      if (document.visibilityState === "visible") revalidate();
    };
    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("focus", onReturn);
    return () => {
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener("focus", onReturn);
    };
  }, [revalidate]);

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
