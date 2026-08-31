import { data } from "react-router";
import { eq } from "drizzle-orm";
import { db } from "~/db";
import { exercises, progressionSteps } from "~/db/schema";

export async function loadExercises() {
  return db.query.exercises.findMany({
    orderBy: (e, { asc }) => asc(e.id),
    with: { steps: { orderBy: (s, { asc }) => asc(s.position) } },
  });
}

export type ExercisesData = Awaited<ReturnType<typeof loadExercises>>;

function parseSteps(raw: string) {
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

// Atomic delete+insert via db.batch (rolls back together), with inserts
// chunked to stay under D1's 100-bound-parameters-per-statement limit.
async function replaceSteps(exerciseId: number, lines: string[]) {
  const rows = lines.map((description, i) => ({ exerciseId, position: i + 1, description }));
  const chunks = [];
  for (let i = 0; i < rows.length; i += 30) chunks.push(rows.slice(i, i + 30));
  await db.batch([
    db.delete(progressionSteps).where(eq(progressionSteps.exerciseId, exerciseId)),
    ...chunks.map((c) => db.insert(progressionSteps).values(c)),
  ]);
}

export async function exercisesAction(form: FormData, intent: string) {
  if (intent === "exercise-add") {
    const name = String(form.get("name") ?? "").trim();
    if (!name)
      return data({ error: "Name is required.", scope: "exercises" }, { status: 400 });
    const [ex] = await db.insert(exercises).values({ name }).returning();
    await replaceSteps(ex.id, parseSteps(String(form.get("steps") ?? "")));
  }

  if (intent === "exercise-save") {
    const exerciseId = Number(form.get("exerciseId"));
    const name = String(form.get("name") ?? "").trim();
    if (name)
      await db.update(exercises).set({ name }).where(eq(exercises.id, exerciseId));
    await replaceSteps(exerciseId, parseSteps(String(form.get("steps") ?? "")));
    return { ok: true, saved: exerciseId };
  }

  return { ok: true };
}
