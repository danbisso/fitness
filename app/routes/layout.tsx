import { useEffect } from "react";
import { NavLink, Outlet, useNavigation, useRevalidator } from "react-router";
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
  const { revalidate, state: revalidating } = useRevalidator();
  const navigation = useNavigation();
  // Any pending request (navigation, form submit, or a revalidation) dims the
  // page and blocks taps until the fresh data has landed.
  const busy = navigation.state !== "idle" || revalidating !== "idle";

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
      {/* Safe-area padding: in standalone mode the page runs under the
          status bar and home indicator (viewport-fit=cover in root.tsx). */}
      <nav className="border-b bg-card pt-[env(safe-area-inset-top)]">
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
      <main
        aria-busy={busy}
        className={`mx-auto max-w-3xl px-4 py-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] transition-opacity ${
          busy ? "opacity-50 pointer-events-none" : ""
        }`}
      >
        <Outlet />
      </main>
    </div>
  );
}
