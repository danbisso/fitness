import { Form, Link, data, redirect } from "react-router";
import { z } from "zod";
import { db } from "~/db";
import { workoutEntries, workouts } from "~/db/schema";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Field, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { pageCount } from "~/components/LoadMore";
import { DateField, RESULT_OPTIONS, appToday } from "~/lib/ui";
import { fieldErrors } from "~/lib/validation";
import { HistorySection } from "~/sections/history";
import { deleteWorkout, loadHistory } from "~/sections/history.server";
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

  return { plan, items, today: appToday(), history };
}

const workoutHeader = z.object({
  planId: z.coerce.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();

  if (String(form.get("intent") ?? "") === "delete-workout")
    return deleteWorkout(form);

  // Default (no intent): log today's workout.
  const parsed = workoutHeader.safeParse({
    planId: form.get("planId"),
    date: form.get("date") || appToday(),
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

const resultItems = RESULT_OPTIONS.map((r) => ({
  value: r.value,
  label: `${r.emoji} ${r.value}`,
}));

export default function Workout({ loaderData }: Route.ComponentProps) {
  const { plan, items, today, history } = loaderData;

  return (
    <div className="space-y-8">
      {plan ? (
        <Form method="post" className="space-y-4">
          <input type="hidden" name="planId" value={plan.id} />
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <Field className="w-auto">
              <FieldLabel>Date</FieldLabel>
              <DateField defaultValue={today} />
            </Field>
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
          </div>

          {items.map((item) => (
            <Card key={item.exerciseId}>
              <CardHeader>
                <CardTitle>{item.name}</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Field>
                  <FieldLabel>Progression</FieldLabel>
                  <Select
                    name={`step-${item.exerciseId}`}
                    defaultValue={item.prescribed ?? undefined}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {item.steps.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel>How did it feel?</FieldLabel>
                  <Select
                    name={`result-${item.exerciseId}`}
                    defaultValue="Felt good!"
                    items={resultItems}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {resultItems.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field className="col-span-2 sm:col-span-1">
                  <FieldLabel>Notes</FieldLabel>
                  <Input
                    type="text"
                    name={`notes-${item.exerciseId}`}
                    placeholder="optional"
                  />
                </Field>
              </CardContent>
            </Card>
          ))}

          <Button type="submit">Log workout</Button>
        </Form>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-end gap-4 text-sm font-medium">
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
          <p className="text-muted-foreground">
            No active workout plans — create one under Plans.
          </p>
        </div>
      )}

      <section className="space-y-4">
        <h2 className="border-t pt-6 text-lg font-semibold">History</h2>
        <HistorySection workouts={history.workouts} hasMore={history.hasMore} />
      </section>
    </div>
  );
}
