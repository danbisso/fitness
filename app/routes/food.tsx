import { Form } from "react-router";
import { eq } from "drizzle-orm";
import { db } from "~/db";
import { foodLogs } from "~/db/schema";
import { DateField, btnCls, btnGhostCls, cardCls, inputCls, labelCls, utcToday } from "~/lib/ui";
import type { Route } from "./+types/food";

export async function loader() {
  const rows = await db.query.foodLogs.findMany({
    orderBy: (f, { desc }) => [desc(f.date), desc(f.id)],
  });
  return { logs: rows, today: utcToday() };
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  if (form.get("intent") === "delete") {
    await db.delete(foodLogs).where(eq(foodLogs.id, Number(form.get("id"))));
    return { ok: true };
  }
  const food = String(form.get("food") ?? "").trim();
  if (food) {
    await db.insert(foodLogs).values({
      date: String(form.get("date") || utcToday()),
      food,
    });
  }
  return { ok: true };
}

export default function Food({ loaderData }: Route.ComponentProps) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Food log</h1>

      <Form method="post" className={`${cardCls} flex gap-2 items-end flex-wrap`}>
        <div>
          <label className={labelCls}>Date</label>
          <DateField serverToday={loaderData.today} />
        </div>
        <div className="grow min-w-48">
          <label className={labelCls}>What did you eat?</label>
          <input type="text" name="food" required className={`${inputCls} w-full`} />
        </div>
        <button type="submit" className={btnCls}>
          Log
        </button>
      </Form>

      <div className={cardCls}>
        {loaderData.logs.length === 0 && (
          <p className="text-sm text-gray-400">Nothing logged yet.</p>
        )}
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {loaderData.logs.map((l) => (
            <li key={l.id} className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
              <span className="whitespace-nowrap text-gray-500 dark:text-gray-400">{l.date}</span>
              <span className="grow">{l.food}</span>
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
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
