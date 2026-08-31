import { eq } from "drizzle-orm";
import { db } from "~/db";
import { workouts } from "~/db/schema";

export async function loadHistory(count: number) {
  const rows = await db.query.workouts.findMany({
    orderBy: (w, { desc }) => [desc(w.date), desc(w.id)],
    limit: count + 1,
    with: {
      plan: true,
      entries: { with: { exercise: true } },
    },
  });
  return { workouts: rows.slice(0, count), hasMore: rows.length > count };
}

export type HistoryData = Awaited<ReturnType<typeof loadHistory>>;

export async function deleteWorkout(form: FormData) {
  await db.delete(workouts).where(eq(workouts.id, Number(form.get("id"))));
  return { ok: true };
}
