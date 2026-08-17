import { useState } from "react";
import { Form } from "react-router";
import { eq } from "drizzle-orm";
import { db } from "~/db";
import { gutLogs } from "~/db/schema";
import { LineChart } from "~/components/LineChart";
import { DateField, btnCls, btnGhostCls, cardCls, inputCls, labelCls, utcToday } from "~/lib/ui";
import type { Route } from "./+types/gut";

export async function loader() {
  const rows = await db.query.gutLogs.findMany({
    orderBy: (g, { desc }) => [desc(g.date), desc(g.id)],
  });
  return { logs: rows, today: utcToday() };
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  if (form.get("intent") === "delete") {
    await db.delete(gutLogs).where(eq(gutLogs.id, Number(form.get("id"))));
    return { ok: true };
  }
  const num = (k: string) => {
    const v = String(form.get(k) ?? "").trim();
    return v === "" ? null : Number(v);
  };
  await db.insert(gutLogs).values({
    date: String(form.get("date") || utcToday()),
    weightKg: num("weightKg"),
    waistCm: num("waistCm"),
    notes: String(form.get("notes") ?? "").trim() || null,
  });
  return { ok: true };
}

const RANGES = [
  { key: "90d", label: "Last 90 days", days: 90 },
  { key: "1y", label: "Last year", days: 365 },
  { key: "all", label: "All time", days: null },
] as const;

export default function Gut({ loaderData }: Route.ComponentProps) {
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("1y");
  const days = RANGES.find((r) => r.key === range)!.days;
  const cutoff = days
    ? new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
    : null;
  const visible = cutoff
    ? loaderData.logs.filter((l) => l.date >= cutoff)
    : loaderData.logs;
  const asc = [...visible].reverse();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Gut log</h1>

      <Form method="post" className={`${cardCls} grid gap-3 sm:grid-cols-5 items-end`}>
        <div>
          <label className={labelCls}>Date</label>
          <DateField serverToday={loaderData.today} />
        </div>
        <div>
          <label className={labelCls}>Weight (kg)</label>
          <input type="number" step="0.1" name="weightKg" className={`${inputCls} w-full`} />
        </div>
        <div>
          <label className={labelCls}>Waist (cm)</label>
          <input type="number" step="0.5" name="waistCm" className={`${inputCls} w-full`} />
        </div>
        <div className="sm:col-span-2 flex gap-2 items-end">
          <div className="grow">
            <label className={labelCls}>Notes</label>
            <input type="text" name="notes" placeholder="what happened this period" className={`${inputCls} w-full`} />
          </div>
          <button type="submit" className={btnCls}>
            Log
          </button>
        </div>
      </Form>

      <div className="flex gap-1">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className={`rounded-md px-3 py-1.5 text-sm ${
              range === r.key
                ? "bg-blue-600 text-white font-semibold"
                : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className={cardCls}>
        <LineChart
          title="Weight"
          unit="kg"
          points={asc.filter((l) => l.weightKg != null).map((l) => ({ date: l.date, value: l.weightKg! }))}
        />
      </div>
      <div className={cardCls}>
        <LineChart
          title="Waist"
          unit="cm"
          points={asc.filter((l) => l.waistCm != null).map((l) => ({ date: l.date, value: l.waistCm! }))}
        />
      </div>

      <div className={`${cardCls} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 dark:text-gray-400">
              <th className="py-1.5 pr-3">Date</th>
              <th className="py-1.5 pr-3">Weight (kg)</th>
              <th className="py-1.5 pr-3">Waist (cm)</th>
              <th className="py-1.5 pr-3">Notes</th>
              <th />
            </tr>
          </thead>
          <tbody style={{ fontVariantNumeric: "tabular-nums" }}>
            {visible.map((l) => (
              <tr key={l.id} className="border-t border-gray-100 dark:border-gray-800 align-top">
                <td className="py-1.5 pr-3 whitespace-nowrap">{l.date}</td>
                <td className="py-1.5 pr-3">{l.weightKg}</td>
                <td className="py-1.5 pr-3">{l.waistCm}</td>
                <td className="py-1.5 pr-3 text-gray-500 dark:text-gray-400">{l.notes}</td>
                <td className="py-1.5 text-right">
                  <Form
                    method="post"
                    onSubmit={(e) => {
                      if (!confirm("Delete this entry?")) e.preventDefault();
                    }}
                  >
                    <input type="hidden" name="intent" value="delete" />
                    <input type="hidden" name="id" value={l.id} />
                    <button type="submit" className={btnGhostCls}>
                      delete
                    </button>
                  </Form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
