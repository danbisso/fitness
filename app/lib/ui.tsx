import { Input } from "~/components/ui/input";

export const RESULT_OPTIONS = [
  { value: "Felt good!", emoji: "💪" },
  { value: "Last rep(s) too hard", emoji: "🥵" },
  { value: "Form was off", emoji: "🌀" },
  { value: "Missed rep(s)", emoji: "❌" },
  { value: "Skipped", emoji: "⏭️" },
] as const;

// The app's notion of "today" is the calendar day in the *user's* time zone,
// decided per request on the server: the layout syncs the browser's IANA zone
// into a cookie, loaders read it via appToday(request), and the date inputs'
// default, today's totals and the week chart all agree. Stored dates are plain
// calendar days and are never converted, so changing zone (travel) only moves
// the "today" boundary going forward; history is untouched.
export const DEFAULT_TIME_ZONE = "America/Costa_Rica";
export const TZ_COOKIE = "tz";

function isValidTimeZone(zone: string) {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

function readCookie(header: string | null, name: string) {
  for (const part of (header ?? "").split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

// IANA zone for this request: the tz cookie when valid, else the default.
export function requestTimeZone(request: Request) {
  const zone = readCookie(request.headers.get("cookie"), TZ_COOKIE);
  return zone && isValidTimeZone(zone) ? zone : DEFAULT_TIME_ZONE;
}

// YYYY-MM-DD for the current instant in the request's time zone.
export function appToday(request: Request) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: requestTimeZone(request),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// Client side: the browser's zone, and the cookie the server reads it from.
export function browserTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function writeTimeZoneCookie(zone: string) {
  document.cookie = `${TZ_COOKIE}=${encodeURIComponent(zone)}; path=/; max-age=31536000; samesite=lax`;
}

// Calendar arithmetic on YYYY-MM-DD strings. Zone-free by construction: the
// strings are parsed as UTC midnight purely to count whole days, so results
// never depend on the worker's or browser's clock. Always derive relative
// dates ("90 days ago", "this Monday") from appToday() via these helpers.
const DAY_MS = 86400000;

export function addDays(ymd: string, n: number) {
  return new Date(Date.parse(ymd) + n * DAY_MS).toISOString().slice(0, 10);
}

// Whole days from `from` to `to` (negative if `to` is earlier).
export function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS);
}

// Monday of the week containing ymd.
export function mondayOf(ymd: string) {
  const dow = new Date(Date.parse(ymd)).getUTCDay(); // 0 = Sunday
  return addDays(ymd, -((dow + 6) % 7));
}

// Date input; pass `today` from the loader (or a row's date when editing) as
// the default. New-entry forms also pass `key={today}` so the field remounts
// with the fresh default when the day rolls over under an open tab.
export function DateField({
  name = "date",
  defaultValue,
}: {
  name?: string;
  defaultValue: string;
}) {
  return <Input type="date" name={name} required defaultValue={defaultValue} />;
}
