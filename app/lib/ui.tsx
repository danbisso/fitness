import { useEffect, useRef } from "react";
import { Input } from "~/components/ui/input";

export const RESULT_OPTIONS = [
  { value: "Felt good!", emoji: "💪" },
  { value: "Last rep(s) too hard", emoji: "🥵" },
  { value: "Form was off", emoji: "🌀" },
  { value: "Missed rep(s)", emoji: "❌" },
  { value: "Skipped", emoji: "⏭️" },
] as const;

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
    <Input
      ref={ref}
      type="date"
      name={name}
      required
      defaultValue={serverToday}
    />
  );
}
