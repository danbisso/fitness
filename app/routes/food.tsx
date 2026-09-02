import { useEffect, useRef, useState } from "react";
import { Form, data } from "react-router";
import { count, desc, eq, sql } from "drizzle-orm";
import { db } from "~/db";
import { foodLogs, settings } from "~/db/schema";
import { WeekBarChart } from "~/components/WeekBarChart";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Field, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { LoadMoreSentinel, pageCount } from "~/components/LoadMore";
import { DateField, addDays, appToday, daysBetween, mondayOf } from "~/lib/ui";
import {
  dailyTargetUpdate,
  fieldErrors,
  foodLogInsert,
  foodLogUpdate,
} from "~/lib/validation";
import type { Route } from "./+types/food";

const TARGET_KEY = "daily_calorie_target";
const TARGET_DEFAULT = 2000;

// Calories summed per weekday (Mon..Sun) for the week starting at monday.
function weekTotals(logs: { date: string; calories: number | null }[], monday: string) {
  const out = Array(7).fill(0);
  for (const l of logs) {
    const i = daysBetween(monday, l.date);
    if (i >= 0 && i < 7) out[i] += l.calories ?? 0;
  }
  return out;
}

// The 3 most-logged foods (case-insensitive), each labeled and calorie-filled
// from its most recent entry (most recent, not most common, so it can't go
// stale and the latest spelling/casing wins).
async function loadQuickAdds() {
  const lowerFood = sql<string>`lower(${foodLogs.food})`;
  const common = await db
    .select({ key: lowerFood, n: count() })
    .from(foodLogs)
    .groupBy(lowerFood)
    .orderBy(desc(count()), lowerFood)
    .limit(3);
  const picks = await Promise.all(
    common.map((c) =>
      db.query.foodLogs.findFirst({
        where: eq(lowerFood, c.key),
        orderBy: (f, { desc }) => [desc(f.date), desc(f.id)],
      }),
    ),
  );
  return picks
    .filter((p) => p != null)
    .map((p) => ({ food: p.food, calories: p.calories }));
}

export async function loader({ request }: Route.LoaderArgs) {
  const count = pageCount(request);
  const today = appToday();
  const mondayCurr = mondayOf(today);
  const mondayPrev = addDays(mondayCurr, -7);

  const [rows, weekRows, targetRow, quickAdds] = await Promise.all([
    // A few extra rows so the page can be extended to a whole-day boundary.
    db.query.foodLogs.findMany({
      orderBy: (f, { desc }) => [desc(f.date), desc(f.id)],
      limit: count + 40,
    }),
    // Chart + today's total only need the current and previous week.
    db.query.foodLogs.findMany({
      columns: { date: true, calories: true },
      where: (f, { gte }) => gte(f.date, mondayPrev),
    }),
    db.query.settings.findFirst({ where: (s, { eq }) => eq(s.key, TARGET_KEY) }),
    loadQuickAdds(),
  ]);

  // Never cut a page mid-day, so per-day totals are always complete.
  let end = Math.min(count, rows.length);
  while (end > 0 && end < rows.length && rows[end].date === rows[end - 1].date) end++;

  const target = Number(targetRow?.value) || TARGET_DEFAULT;
  const todayTotal = weekRows
    .filter((l) => l.date === today)
    .reduce((sum, l) => sum + (l.calories ?? 0), 0);

  return {
    logs: rows.slice(0, end),
    hasMore: rows.length > end,
    quickAdds,
    today,
    target,
    todayTotal,
    curr: weekTotals(weekRows, mondayCurr),
    prev: weekTotals(weekRows, mondayPrev),
  };
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const intent = form.get("intent");
  if (intent === "delete") {
    await db.delete(foodLogs).where(eq(foodLogs.id, Number(form.get("id"))));
    return { ok: true };
  }
  if (intent === "update") {
    const parsed = foodLogUpdate.safeParse(Object.fromEntries(form));
    if (!parsed.success) {
      return data({ errors: fieldErrors(parsed.error) }, { status: 400 });
    }
    const { id, ...values } = parsed.data;
    await db.update(foodLogs).set(values).where(eq(foodLogs.id, id));
    return { ok: true };
  }
  if (intent === "set-target") {
    const parsed = dailyTargetUpdate.safeParse(Object.fromEntries(form));
    if (!parsed.success) {
      return data({ errors: fieldErrors(parsed.error) }, { status: 400 });
    }
    const value = String(parsed.data.target);
    await db
      .insert(settings)
      .values({ key: TARGET_KEY, value })
      .onConflictDoUpdate({ target: settings.key, set: { value } });
    return { ok: true };
  }
  const parsed = foodLogInsert.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    return data({ errors: fieldErrors(parsed.error) }, { status: 400 });
  }
  await db.insert(foodLogs).values(parsed.data);
  return { ok: true };
}

export default function Food({ loaderData, actionData }: Route.ComponentProps) {
  const { logs, hasMore, quickAdds, today, target, todayTotal, curr, prev } =
    loaderData;
  const formRef = useRef<HTMLFormElement>(null);
  const [editingTarget, setEditingTarget] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const errors =
    actionData && "errors" in actionData ? actionData.errors : null;

  // Clear the entry fields after a successful action (date stays put) and
  // leave any edit mode.
  useEffect(() => {
    if (actionData && "ok" in actionData && actionData.ok) {
      if (formRef.current) {
        for (const name of ["food", "calories"]) {
          const el = formRef.current.elements.namedItem(name);
          if (el instanceof HTMLInputElement) el.value = "";
        }
      }
      setEditingTarget(false);
      setEditingId(null);
    }
  }, [actionData]);

  const errorText = errors && (
    <p className="mt-2 text-sm text-destructive">
      {Object.values(errors).flat().join(" · ")}
    </p>
  );

  function bumpCalories(delta: number) {
    const el = formRef.current?.elements.namedItem("calories");
    if (el instanceof HTMLInputElement) {
      el.value = String(Math.max(0, (Number(el.value) || 0) + delta));
    }
  }

  function quickAdd(food: string, calories: number | null) {
    const f = formRef.current?.elements.namedItem("food");
    const c = formRef.current?.elements.namedItem("calories");
    if (f instanceof HTMLInputElement) f.value = food;
    if (c instanceof HTMLInputElement)
      c.value = calories != null ? String(calories) : "";
  }

  const remaining = target - todayTotal;
  const remainingPct = remaining / target;
  const remainingColor =
    remaining < 0
      ? "text-red-600 dark:text-red-400"
      : remainingPct > 0.25
        ? "text-green-600 dark:text-green-400"
        : remainingPct > 0.1
          ? "text-yellow-600 dark:text-yellow-400"
          : "text-orange-600 dark:text-orange-400";

  // logs come sorted by date desc — group consecutive rows per date.
  const groups: { date: string; items: typeof logs; total: number }[] = [];
  for (const l of logs) {
    const g = groups[groups.length - 1];
    if (g && g.date === l.date) {
      g.items.push(l);
      g.total += l.calories ?? 0;
    } else {
      groups.push({ date: l.date, items: [l], total: l.calories ?? 0 });
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent>
          <Form ref={formRef} method="post" className="flex gap-2 items-end flex-wrap">
            <Field className="w-auto">
              <FieldLabel>Date</FieldLabel>
              <DateField defaultValue={today} />
            </Field>
            <Field className="grow min-w-48">
              <FieldLabel htmlFor="food">What did you eat?</FieldLabel>
              <Input id="food" type="text" name="food" required />
            </Field>
            {quickAdds.length > 0 && (
              <div className="basis-full flex flex-wrap gap-1.5">
                {quickAdds.map((q) => (
                  <Button
                    key={q.food}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="max-w-44"
                    onClick={() => quickAdd(q.food, q.calories)}
                  >
                    <span className="truncate">{q.food}</span>
                  </Button>
                ))}
              </div>
            )}
            <Field className="w-28">
              <FieldLabel htmlFor="calories">Calories</FieldLabel>
              <Input id="calories" type="number" name="calories" min="0" />
            </Field>
            <div className="flex items-end gap-1.5">
              <Button type="button" variant="outline" onClick={() => bumpCalories(100)}>
                +100
              </Button>
              <Button type="button" variant="outline" onClick={() => bumpCalories(25)}>
                +25
              </Button>
              <Button type="button" variant="outline" onClick={() => bumpCalories(-100)}>
                −100
              </Button>
              <Button type="submit">Log</Button>
            </div>
          </Form>
          {editingId == null && errorText}
        </CardContent>
      </Card>

      <Card size="sm">
        <CardContent className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <div>
            <div className="text-xs text-muted-foreground">Today's calories</div>
            <div
              className="text-2xl font-bold"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {todayTotal.toLocaleString("en-US")}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Remaining</div>
            <div
              className={`text-2xl font-bold ${remainingColor}`}
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {remaining < 0 ? (
                <>
                  {Math.abs(remaining).toLocaleString("en-US")}{" "}
                  <span className="text-xs font-normal">over</span>
                </>
              ) : (
                remaining.toLocaleString("en-US")
              )}
            </div>
          </div>
          <div className="ml-auto">
            {editingTarget ? (
              <Form method="post" className="flex items-end gap-2">
                <input type="hidden" name="intent" value="set-target" />
                <Field className="w-24">
                  <FieldLabel htmlFor="target">Target</FieldLabel>
                  <Input
                    id="target"
                    type="number"
                    name="target"
                    min="1"
                    defaultValue={target}
                    required
                  />
                </Field>
                <Button type="submit" size="sm">
                  Save
                </Button>
              </Form>
            ) : (
              <div className="text-right text-xs text-muted-foreground">
                <div>Target {target.toLocaleString("en-US")}</div>
                <button
                  type="button"
                  className="underline underline-offset-2 hover:text-foreground"
                  onClick={() => setEditingTarget(true)}
                >
                  Edit target
                </button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <WeekBarChart prev={prev} curr={curr} />
        </CardContent>
      </Card>

      {groups.length === 0 && (
        <p className="text-sm text-muted-foreground">Nothing logged yet.</p>
      )}
      {groups.map((g) => (
        <Card key={g.date} size="sm">
          <CardHeader>
            <CardTitle>{g.date}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {g.items.map((l) =>
                editingId === l.id ? (
                  <li key={l.id} className="py-1.5">
                    <Form method="post" className="flex gap-2 items-end flex-wrap">
                      <input type="hidden" name="intent" value="update" />
                      <input type="hidden" name="id" value={l.id} />
                      <Field className="w-auto">
                        <FieldLabel>Date</FieldLabel>
                        <DateField defaultValue={l.date} />
                      </Field>
                      <Field className="grow min-w-48">
                        <FieldLabel htmlFor={`food-${l.id}`}>Food</FieldLabel>
                        <Input
                          id={`food-${l.id}`}
                          type="text"
                          name="food"
                          defaultValue={l.food}
                          required
                        />
                      </Field>
                      <Field className="w-28">
                        <FieldLabel htmlFor={`calories-${l.id}`}>Calories</FieldLabel>
                        <Input
                          id={`calories-${l.id}`}
                          type="number"
                          name="calories"
                          min="0"
                          defaultValue={l.calories ?? ""}
                        />
                      </Field>
                      <div className="flex items-end gap-1.5">
                        <Button type="submit">Save</Button>
                        <Button type="button" variant="outline" onClick={() => setEditingId(null)}>
                          Cancel
                        </Button>
                      </div>
                    </Form>
                    {errorText}
                  </li>
                ) : (
                  <li key={l.id} className="flex items-baseline gap-3 py-1.5 text-sm">
                    <span className="grow">{l.food}</span>
                    <span
                      className="text-muted-foreground"
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {l.calories != null ? l.calories.toLocaleString("en-US") : "—"}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => setEditingId(l.id)}
                    >
                      edit
                    </Button>
                    <Form
                      method="post"
                      onSubmit={(e) => {
                        if (!confirm("Delete this entry?")) e.preventDefault();
                      }}
                    >
                      <input type="hidden" name="intent" value="delete" />
                      <input type="hidden" name="id" value={l.id} />
                      <Button type="submit" variant="ghost" size="xs" className="text-muted-foreground hover:text-destructive">
                        delete
                      </Button>
                    </Form>
                  </li>
                ),
              )}
            </ul>
            <div className="flex justify-between border-t pt-1.5 mt-1 text-sm font-semibold">
              <span>Total</span>
              <span style={{ fontVariantNumeric: "tabular-nums" }} className="mr-14">
                {g.total.toLocaleString("en-US")}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}

      <LoadMoreSentinel hasMore={hasMore} loaded={logs.length} />
    </div>
  );
}
