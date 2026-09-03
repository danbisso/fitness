import { useEffect, useState } from "react";
import { Form, Link, data, redirect } from "react-router";
import { z } from "zod";
import { db } from "~/db";
import { workoutEntries, workouts } from "~/db/schema";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Field, FieldLabel } from "~/components/ui/field";
import { pageCount } from "~/components/LoadMore";
import { DateField, appToday } from "~/lib/ui";
import { fieldErrors } from "~/lib/validation";
import { ExerciseFields, HistorySection } from "~/sections/history";
import { deleteWorkout, loadHistory, updateWorkout } from "~/sections/history.server";
import { loadPlans } from "~/sections/plans.server";
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

// The step to prescribe, derived from the exercise's latest logged entry:
// "Felt good!" → the step after the one performed; anything else → repeat it;
// no history (or the logged text no longer matches a step) → the first step.
async function prescribe(exerciseId: number, steps: { description: string }[]) {
  if (steps.length === 0) return null;
  const last = await db.query.workoutEntries.findFirst({
    where: (we, { eq }) => eq(we.exerciseId, exerciseId),
    orderBy: (we, { desc }) => desc(we.id),
  });
  if (!last) return steps[0].description;
  const idx = steps.findIndex((s) => s.description === last.stepDescription);
  if (idx === -1) return steps[0].description;
  return last.result === "Felt good!"
    ? steps[Math.min(idx + 1, steps.length - 1)].description
    : steps[idx].description;
}

export async function loader({ request }: Route.LoaderArgs) {
  const [history, allPlans] = await Promise.all([
    loadHistory(pageCount(request)),
    loadPlans(),
  ]);

  // Alternation is enforced: always the active plan after the last logged one.
  // A last workout on an archived plan finds no index → -1 + 1 → first active.
  const activePlans = allPlans.filter((p) => !p.archived);
  const lastWorkout = await db.query.workouts.findFirst({
    orderBy: (w, { desc }) => [desc(w.date), desc(w.id)],
  });

  let plan: (typeof activePlans)[number] | null = null;
  if (activePlans.length > 0) {
    if (lastWorkout) {
      const lastIdx = activePlans.findIndex((p) => p.id === lastWorkout.planId);
      plan = activePlans[(lastIdx + 1) % activePlans.length];
    } else {
      plan = activePlans[0];
    }
  }

  const planExs = plan ? await loadPlanExercises(plan.id) : [];
  const items = await Promise.all(
    planExs.map(async (pe) => ({
      exerciseId: pe.exercise.id,
      name: pe.exercise.name,
      steps: pe.exercise.steps.map((s) => s.description),
      prescribed: await prescribe(pe.exercise.id, pe.exercise.steps),
    })),
  );

  return { plan, items, today: appToday(request), history };
}

const workoutHeader = z.object({
  planId: z.coerce.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();

  const intent = String(form.get("intent") ?? "");
  if (intent === "delete-workout") return deleteWorkout(form);
  if (intent === "update-workout") return updateWorkout(form);

  // Default (no intent): log today's workout.
  const parsed = workoutHeader.safeParse({
    planId: form.get("planId"),
    date: form.get("date") || appToday(request),
  });
  if (!parsed.success) {
    return data({ errors: fieldErrors(parsed.error) }, { status: 400 });
  }
  const { planId, date } = parsed.data;

  const planExs = await loadPlanExercises(planId);
  const [workout] = await db
    .insert(workouts)
    .values({ planId, date })
    .returning();

  for (const pe of planExs) {
    const rawResult = String(form.get(`result-${pe.exercise.id}`) ?? "");
    const result = rawResult === "Skipped" || rawResult === "" ? null : rawResult;
    const notes = String(form.get(`notes-${pe.exercise.id}`) ?? "").trim() || null;
    const step = String(form.get(`step-${pe.exercise.id}`) ?? "").trim() || "—";

    await db.insert(workoutEntries).values({
      workoutId: workout.id,
      exerciseId: pe.exercise.id,
      stepDescription: step,
      result,
      notes,
    });
  }

  return redirect("/workouts");
}

const planLinks = (
  <div className="flex gap-4 pb-2 text-sm font-medium">
    <Link
      to="/exercises"
      className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
    >
      Exercises
    </Link>
    <Link
      to="/plans"
      className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
    >
      Plans
    </Link>
  </div>
);

export default function Workout({ loaderData, actionData }: Route.ComponentProps) {
  const { plan, items, today, history } = loaderData;
  const [editingId, setEditingId] = useState<number | null>(null);

  const errors =
    actionData && "errors" in actionData ? actionData.errors : null;

  // Leave edit mode after a successful update/delete (logging redirects).
  useEffect(() => {
    if (actionData && "ok" in actionData && actionData.ok) setEditingId(null);
  }, [actionData]);

  const errorText = errors && (
    <p className="mt-2 text-sm text-destructive">
      {Object.values(errors).flat().join(" · ")}
    </p>
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardContent>
          {plan ? (
            <Form method="post" className="space-y-4">
              <input type="hidden" name="planId" value={plan.id} />
              <div className="flex items-end justify-between gap-4 flex-wrap">
                <Field className="w-auto">
                  <FieldLabel>Date</FieldLabel>
                  <DateField key={today} defaultValue={today} />
                </Field>
                {planLinks}
              </div>

              {items.map((item) => (
                <div key={item.exerciseId} className="border-t pt-4 space-y-3">
                  <h3 className="font-medium">{item.name}</h3>
                  <ExerciseFields
                    suffix={item.exerciseId}
                    steps={item.steps}
                    step={item.prescribed}
                    result="Felt good!"
                  />
                </div>
              ))}

              <Button type="submit">Log workout</Button>
            </Form>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-end">{planLinks}</div>
              <p className="text-muted-foreground">
                No active workout plans — create one under Plans.
              </p>
            </div>
          )}
          {editingId == null && errorText}
        </CardContent>
      </Card>

      <h2 className="text-lg font-semibold">History</h2>
      <HistorySection
        workouts={history.workouts}
        hasMore={history.hasMore}
        editingId={editingId}
        onEdit={setEditingId}
        errorText={editingId != null ? errorText : null}
      />
    </div>
  );
}
