import { Form, Link, redirect } from "react-router";
import { eq } from "drizzle-orm";
import { db } from "~/db";
import { exercises, workoutEntries, workouts } from "~/db/schema";
import {
  DateField,
  RESULT_OPTIONS,
  btnCls,
  cardCls,
  inputCls,
  labelCls,
  utcToday,
} from "~/lib/ui";
import type { Route } from "./+types/workout";

async function loadPlanExercises(planId: number) {
  return db.query.planExercises.findMany({
    where: (pe, { eq }) => eq(pe.planId, planId),
    orderBy: (pe, { asc }) => asc(pe.position),
    with: {
      exercise: {
        with: { steps: { orderBy: (s, { asc }) => asc(s.position) } },
      },
    },
  });
}

function currentAndNext(ex: {
  currentStepId: number | null;
  steps: { id: number; description: string }[];
}) {
  const idx = ex.currentStepId
    ? ex.steps.findIndex((s) => s.id === ex.currentStepId)
    : 0;
  const current = ex.steps[idx === -1 ? 0 : idx] ?? null;
  const next = ex.steps[(idx === -1 ? 0 : idx) + 1] ?? null;
  return { current, next };
}

export async function loader() {
  const allPlans = await db.query.plans.findMany({
    orderBy: (p, { asc }) => asc(p.position),
  });
  if (allPlans.length === 0) {
    return { plan: null, items: [], today: utcToday(), lastWorkout: null };
  }

  const lastWorkout = await db.query.workouts.findFirst({
    orderBy: (w, { desc }) => [desc(w.date), desc(w.id)],
    with: { plan: true },
  });

  // Alternation is enforced: always the plan after the last logged one.
  let plan: (typeof allPlans)[number];
  if (lastWorkout) {
    const lastIdx = allPlans.findIndex((p) => p.id === lastWorkout.planId);
    plan = allPlans[(lastIdx + 1) % allPlans.length];
  } else {
    plan = allPlans[0];
  }

  const planExs = await loadPlanExercises(plan.id);
  const items = planExs.map((pe) => {
    const { current, next } = currentAndNext(pe.exercise);
    return {
      exerciseId: pe.exercise.id,
      name: pe.exercise.name,
      current: current?.description ?? null,
      next: next?.description ?? null,
    };
  });

  return { plan, items, today: utcToday(), lastWorkout };
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const planId = Number(form.get("planId"));
  const date = String(form.get("date") || utcToday());

  const planExs = await loadPlanExercises(planId);
  const [workout] = await db
    .insert(workouts)
    .values({ planId, date })
    .returning();

  for (const pe of planExs) {
    const { current, next } = currentAndNext(pe.exercise);
    const rawResult = String(form.get(`result-${pe.exercise.id}`) ?? "");
    const result = rawResult === "Skipped" || rawResult === "" ? null : rawResult;
    const notes = String(form.get(`notes-${pe.exercise.id}`) ?? "").trim() || null;

    await db.insert(workoutEntries).values({
      workoutId: workout.id,
      exerciseId: pe.exercise.id,
      stepDescription: current?.description ?? "—",
      result,
      notes,
    });

    if (result === "Felt good!" && next) {
      await db
        .update(exercises)
        .set({ currentStepId: next.id })
        .where(eq(exercises.id, pe.exercise.id));
    }
  }

  return redirect("/workouts");
}

export default function Workout({ loaderData }: Route.ComponentProps) {
  const { plan, items, today, lastWorkout } = loaderData;

  if (!plan) {
    return (
      <p className="text-gray-500">
        No workout plans yet — create one on the{" "}
        <Link to="/plans" className="text-blue-600 underline">
          Plans
        </Link>{" "}
        page.
      </p>
    );
  }

  return (
    <Form method="post" className="space-y-4">
      <input type="hidden" name="planId" value={plan.id} />
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">{plan.name}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {lastWorkout
              ? `Last workout: ${lastWorkout.plan.name} on ${lastWorkout.date}`
              : "First workout!"}
          </p>
        </div>
        <div>
          <label className={labelCls}>Date</label>
          <DateField serverToday={today} />
        </div>
      </div>

      {items.map((item) => (
        <div key={item.exerciseId} className={cardCls}>
          <div className="flex items-baseline justify-between gap-2 flex-wrap">
            <h2 className="font-semibold">{item.name}</h2>
            <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
              {item.current ?? "no progression set"}
            </span>
          </div>
          {item.next && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              next up: {item.next}
            </p>
          )}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>How did it feel?</label>
              <select
                name={`result-${item.exerciseId}`}
                defaultValue="Felt good!"
                className={`${inputCls} w-full`}
              >
                {RESULT_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.emoji} {r.value}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Notes</label>
              <input
                type="text"
                name={`notes-${item.exerciseId}`}
                placeholder="optional"
                className={`${inputCls} w-full`}
              />
            </div>
          </div>
        </div>
      ))}

      <button type="submit" className={btnCls}>
        Log workout
      </button>
    </Form>
  );
}
