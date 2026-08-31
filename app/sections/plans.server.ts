import { data } from "react-router";
import { count, eq, max } from "drizzle-orm";
import { db } from "~/db";
import { planExercises, plans, workouts } from "~/db/schema";

export async function loadPlans() {
  const [allPlans, counts] = await Promise.all([
    db.query.plans.findMany({
      orderBy: (p, { asc }) => asc(p.position),
      with: {
        planExercises: {
          orderBy: (pe, { asc }) => asc(pe.position),
          with: { exercise: true },
        },
      },
    }),
    db
      .select({ planId: workouts.planId, n: count() })
      .from(workouts)
      .groupBy(workouts.planId),
  ]);
  const countByPlan = new Map(counts.map((c) => [c.planId, c.n]));
  return allPlans.map((p) => ({ ...p, workoutCount: countByPlan.get(p.id) ?? 0 }));
}

export type PlansData = Awaited<ReturnType<typeof loadPlans>>;

export async function plansAction(form: FormData, intent: string) {
  if (intent === "plan-add") {
    const name = String(form.get("name") ?? "").trim();
    if (!name)
      return data({ error: "Name is required.", scope: "plans" }, { status: 400 });
    const [{ maxPos }] = await db.select({ maxPos: max(plans.position) }).from(plans);
    await db.insert(plans).values({ name, position: (maxPos ?? 0) + 1 });
  }

  if (intent === "plan-rename") {
    const name = String(form.get("name") ?? "").trim();
    if (!name)
      return data({ error: "Name is required.", scope: "plans" }, { status: 400 });
    await db.update(plans).set({ name }).where(eq(plans.id, Number(form.get("planId"))));
  }

  if (intent === "plan-archive" || intent === "plan-unarchive") {
    await db
      .update(plans)
      .set({ archived: intent === "plan-archive" })
      .where(eq(plans.id, Number(form.get("planId"))));
  }

  if (intent === "plan-delete") {
    const planId = Number(form.get("planId"));
    const [{ n }] = await db
      .select({ n: count() })
      .from(workouts)
      .where(eq(workouts.planId, planId));
    if (n > 0)
      return data(
        { error: "This plan has logged workouts — archive it instead.", scope: "plans" },
        { status: 400 },
      );
    await db.delete(plans).where(eq(plans.id, planId));
  }

  if (intent === "plan-add-exercise") {
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

  if (intent === "plan-remove-exercise") {
    await db
      .delete(planExercises)
      .where(eq(planExercises.id, Number(form.get("planExerciseId"))));
  }

  return { ok: true };
}
