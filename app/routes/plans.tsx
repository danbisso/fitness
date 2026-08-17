import { Form, data } from "react-router";
import { count, eq, max } from "drizzle-orm";
import { db } from "~/db";
import { planExercises, plans, workouts } from "~/db/schema";
import { btnCls, btnGhostCls, cardCls, inputCls } from "~/lib/ui";
import type { Route } from "./+types/plans";

export async function loader() {
  const allPlans = await db.query.plans.findMany({
    orderBy: (p, { asc }) => asc(p.position),
    with: {
      planExercises: {
        orderBy: (pe, { asc }) => asc(pe.position),
        with: { exercise: true },
      },
    },
  });
  const allExercises = await db.query.exercises.findMany({
    orderBy: (e, { asc }) => asc(e.name),
  });
  return { plans: allPlans, exercises: allExercises };
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const intent = String(form.get("intent"));

  if (intent === "add-plan") {
    const name = String(form.get("name") ?? "").trim();
    if (!name) return data({ error: "Name is required." }, { status: 400 });
    const [{ maxPos }] = await db.select({ maxPos: max(plans.position) }).from(plans);
    await db.insert(plans).values({ name, position: (maxPos ?? 0) + 1 });
  }

  if (intent === "delete-plan") {
    const planId = Number(form.get("planId"));
    const [{ n }] = await db
      .select({ n: count() })
      .from(workouts)
      .where(eq(workouts.planId, planId));
    if (n > 0)
      return data(
        { error: "This plan has logged workouts — can't delete it." },
        { status: 400 },
      );
    await db.delete(plans).where(eq(plans.id, planId));
  }

  if (intent === "add-exercise") {
    const planId = Number(form.get("planId"));
    const exerciseId = Number(form.get("exerciseId"));
    if (!exerciseId) return { ok: true };
    const [{ maxPos }] = await db
      .select({ maxPos: max(planExercises.position) })
      .from(planExercises)
      .where(eq(planExercises.planId, planId));
    await db
      .insert(planExercises)
      .values({ planId, exerciseId, position: (maxPos ?? 0) + 1 });
  }

  if (intent === "remove-exercise") {
    await db
      .delete(planExercises)
      .where(eq(planExercises.id, Number(form.get("planExerciseId"))));
  }

  return { ok: true };
}

export default function Plans({ loaderData, actionData }: Route.ComponentProps) {
  const error = actionData && "error" in actionData ? actionData.error : null;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Workout plans</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Workouts alternate through these plans in order.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {loaderData.plans.map((p) => (
        <div key={p.id} className={cardCls}>
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold">{p.name}</h2>
            <Form
              method="post"
              onSubmit={(e) => {
                if (!confirm(`Delete ${p.name}?`)) e.preventDefault();
              }}
            >
              <input type="hidden" name="intent" value="delete-plan" />
              <input type="hidden" name="planId" value={p.id} />
              <button type="submit" className={btnGhostCls}>
                delete plan
              </button>
            </Form>
          </div>
          <ul className="mt-2 divide-y divide-gray-100 dark:divide-gray-800">
            {p.planExercises.map((pe) => (
              <li key={pe.id} className="flex items-center justify-between py-1.5 text-sm">
                <span>
                  {pe.position}. {pe.exercise.name}
                </span>
                <Form method="post">
                  <input type="hidden" name="intent" value="remove-exercise" />
                  <input type="hidden" name="planExerciseId" value={pe.id} />
                  <button type="submit" className={btnGhostCls}>
                    remove
                  </button>
                </Form>
              </li>
            ))}
          </ul>
          <Form method="post" className="mt-2 flex gap-2">
            <input type="hidden" name="intent" value="add-exercise" />
            <input type="hidden" name="planId" value={p.id} />
            <select name="exerciseId" className={inputCls}>
              {loaderData.exercises
                .filter((e) => !p.planExercises.some((pe) => pe.exerciseId === e.id))
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
            </select>
            <button type="submit" className={btnCls}>
              Add exercise
            </button>
          </Form>
        </div>
      ))}

      <div className={cardCls}>
        <h2 className="font-semibold mb-2">Add plan</h2>
        <Form method="post" className="flex gap-2">
          <input type="hidden" name="intent" value="add-plan" />
          <input name="name" required placeholder="Workout C" className={inputCls} />
          <button type="submit" className={btnCls}>
            Add
          </button>
        </Form>
      </div>
    </div>
  );
}
