import { useEffect, useRef } from "react";

export const RESULT_OPTIONS = [
  { value: "Felt good!", emoji: "💪" },
  { value: "Last rep(s) too hard", emoji: "🥵" },
  { value: "Form was off", emoji: "🌀" },
  { value: "Missed rep(s)", emoji: "❌" },
  { value: "Skipped", emoji: "⏭️" },
] as const;

export const inputCls =
  "rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500";

export const btnCls =
  "rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50";

export const btnGhostCls =
  "rounded-md px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400";

export const cardCls =
  "rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4";

export const labelCls =
  "block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1";

export function utcToday() {
  return new Date().toISOString().slice(0, 10);
}

function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Date input auto-populated with *local* today. SSR renders the server (UTC)
// date; an effect corrects it to the browser's local date on mount.
export function DateField({
  name = "date",
  serverToday,
}: {
  name?: string;
  serverToday: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current && ref.current.value === serverToday) {
      ref.current.value = localToday();
    }
  }, [serverToday]);
  return (
    <input
      ref={ref}
      type="date"
      name={name}
      required
      defaultValue={serverToday}
      className={inputCls}
    />
  );
}
