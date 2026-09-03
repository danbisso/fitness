import { eq } from "drizzle-orm";
import { data } from "react-router";
import { db } from "~/db";
import { workoutEntries, workouts } from "~/db/schema";
import { fieldErrors, workoutUpdate } from "~/lib/validation";

export async function loadHistory(count: number) {
  const rows = await db.query.workouts.findMany({
    orderBy: (w, { desc }) => [desc(w.date), desc(w.id)],
    limit: count + 1,
    with: {
      plan: true,
      entries: {
        with: {
          // Steps feed the progression dropdown when a workout is edited.
          exercise: {
            with: { steps: { orderBy: (s, { asc }) => asc(s.position) } },
          },
        },
      },
    },
  });
  return { workouts: rows.slice(0, count), hasMore: rows.length > count };
}

export type HistoryData = Awaited<ReturnType<typeof loadHistory>>;

export async function deleteWorkout(form: FormData) {
  await db.delete(workouts).where(eq(workouts.id, Number(form.get("id"))));
  return { ok: true };
}

// Edit a logged workout in place: its date plus each entry's step / result /
// notes. Entries are addressed by their own id so the form can't touch
// another workout's rows. Prescription derives from the latest entry, so a
// corrected result immediately changes what the next workout prescribes.
export async function updateWorkout(form: FormData) {
  const parsed = workoutUpdate.safeParse({ id: form.get("id"), date: form.get("date") });
  if (!parsed.success) {
    return data({ errors: fieldErrors(parsed.error) }, { status: 400 });
  }
  const { id, date } = parsed.data;

  const entries = await db.query.workoutEntries.findMany({
    where: (we, { eq }) => eq(we.workoutId, id),
  });

  await db.batch([
    db.update(workouts).set({ date }).where(eq(workouts.id, id)),
    ...entries.map((e) => {
      const rawResult = String(form.get(`result-${e.id}`) ?? "");
      const result = rawResult === "Skipped" || rawResult === "" ? null : rawResult;
      const notes = String(form.get(`notes-${e.id}`) ?? "").trim() || null;
      const step = String(form.get(`step-${e.id}`) ?? "").trim() || "\u2014";
      return db
        .update(workoutEntries)
        .set({ stepDescription: step, result, notes })
        .where(eq(workoutEntries.id, e.id));
    }),
  ]);

  return { ok: true };
}
