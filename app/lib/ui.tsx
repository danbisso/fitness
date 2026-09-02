import { Input } from "~/components/ui/input";

export const RESULT_OPTIONS = [
  { value: "Felt good!", emoji: "💪" },
  { value: "Last rep(s) too hard", emoji: "🥵" },
  { value: "Form was off", emoji: "🌀" },
  { value: "Missed rep(s)", emoji: "❌" },
  { value: "Skipped", emoji: "⏭️" },
] as const;

// The app's single notion of "today". Hard-coded to Costa Rica (UTC-6, no
// DST) so the server-computed date, the date inputs' default, today's totals
// and the week chart all agree, whatever the worker's or browser's clock says.
export const APP_TIME_ZONE = "America/Costa_Rica";

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// YYYY-MM-DD for the current instant in APP_TIME_ZONE.
export function appToday() {
  return dayFormatter.format(new Date());
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

// Date input; pass the app-zone `today` from the loader (or a row's date when
// editing) as the default.
export function DateField({
  name = "date",
  defaultValue,
}: {
  name?: string;
  defaultValue: string;
}) {
  return <Input type="date" name={name} required defaultValue={defaultValue} />;
}
