import { Form, data } from "react-router";
import { count, eq } from "drizzle-orm";
import { db } from "~/db";
import { exercises, progressionSteps, workoutEntries } from "~/db/schema";
import { btnCls, btnGhostCls, cardCls, inputCls, labelCls } from "~/lib/ui";
import type { Route } from "./+types/exercises";

export async function loader() {
  const rows = await db.query.exercises.findMany({
    orderBy: (e, { asc }) => asc(e.id),
    with: { steps: { orderBy: (s, { asc }) => asc(s.position) } },
  });
  return { exercises: rows };
}

function parseSteps(raw: string) {
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

async function replaceSteps(exerciseId: number, lines: string[]) {
  const old = await db.query.progressionSteps.findMany({
    where: (s, { eq }) => eq(s.exerciseId, exerciseId),
    orderBy: (s, { asc }) => asc(s.position),
  });
  const ex = await db.query.exercises.findFirst({
    where: (e, { eq }) => eq(e.id, exerciseId),
  });
  const oldCurrent = old.find((s) => s.id === ex?.currentStepId);

  await db.delete(progressionSteps).where(eq(progressionSteps.exerciseId, exerciseId));
  const inserted = lines.length
    ? await db
        .insert(progressionSteps)
        .values(lines.map((description, i) => ({ exerciseId, position: i + 1, description })))
        .returning()
    : [];

  // Keep the pointer: match old current step by text, else by position, else first.
  let newCurrent =
    inserted.find((s) => s.description === oldCurrent?.description) ??
    inserted[Math.min((oldCurrent?.position ?? 1) - 1, inserted.length - 1)] ??
    null;
  await db
    .update(exercises)
    .set({ currentStepId: newCurrent?.id ?? null })
    .where(eq(exercises.id, exerciseId));
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const intent = String(form.get("intent"));

  if (intent === "add") {
    const name = String(form.get("name") ?? "").trim();
    if (!name) return data({ error: "Name is required." }, { status: 400 });
    const [ex] = await db.insert(exercises).values({ name }).returning();
    await replaceSteps(ex.id, parseSteps(String(form.get("steps") ?? "")));
  }

  if (intent === "save") {
    const exerciseId = Number(form.get("exerciseId"));
    const name = String(form.get("name") ?? "").trim();
    if (name)
      await db.update(exercises).set({ name }).where(eq(exercises.id, exerciseId));
    await replaceSteps(exerciseId, parseSteps(String(form.get("steps") ?? "")));
  }

  if (intent === "set-current") {
    const exerciseId = Number(form.get("exerciseId"));
    const stepId = Number(form.get("stepId"));
    await db
      .update(exercises)
      .set({ currentStepId: stepId })
      .where(eq(exercises.id, exerciseId));
  }

  if (intent === "delete") {
    const exerciseId = Number(form.get("exerciseId"));
    const [{ n }] = await db
      .select({ n: count() })
      .from(workoutEntries)
      .where(eq(workoutEntries.exerciseId, exerciseId));
    if (n > 0)
      return data(
        { error: "This exercise has logged workouts — can't delete it." },
        { status: 400 },
      );
    await db.delete(exercises).where(eq(exercises.id, exerciseId));
  }

  return { ok: true };
}

export default function Exercises({ loaderData, actionData }: Route.ComponentProps) {
  const error = actionData && "error" in actionData ? actionData.error : null;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Exercises & progressions</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        One progression step per line — freeform (weight, or variation + reps).
        The highlighted step is the current load; click any step to jump the
        pointer there.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {loaderData.exercises.map((ex) => (
        <details key={ex.id} className={cardCls}>
          <summary className="cursor-pointer select-none flex items-baseline justify-between gap-2">
            <span className="font-semibold">{ex.name}</span>
            <span className="text-sm text-blue-600 dark:text-blue-400">
              {ex.steps.find((s) => s.id === ex.currentStepId)?.description ??
                "no current step"}
            </span>
          </summary>

          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <p className={labelCls}>Progression ({ex.steps.length} steps)</p>
              <ol className="max-h-72 overflow-y-auto rounded-md border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
                {ex.steps.map((s) => (
                  <li key={s.id}>
                    <Form method="post">
                      <input type="hidden" name="intent" value="set-current" />
                      <input type="hidden" name="exerciseId" value={ex.id} />
                      <input type="hidden" name="stepId" value={s.id} />
                      <button
                        type="submit"
                        className={`w-full text-left px-3 py-1 text-sm ${
                          s.id === ex.currentStepId
                            ? "bg-blue-50 dark:bg-blue-950 font-semibold text-blue-700 dark:text-blue-300"
                            : "hover:bg-gray-50 dark:hover:bg-gray-800"
                        }`}
                      >
                        {s.position}. {s.description}
                        {s.id === ex.currentStepId && " ← current"}
                      </button>
                    </Form>
                  </li>
                ))}
              </ol>
            </div>

            <Form method="post" className="space-y-2">
              <input type="hidden" name="intent" value="save" />
              <input type="hidden" name="exerciseId" value={ex.id} />
              <div>
                <label className={labelCls}>Name</label>
                <input name="name" defaultValue={ex.name} className={`${inputCls} w-full`} />
              </div>
              <div>
                <label className={labelCls}>Edit steps (one per line)</label>
                <textarea
                  name="steps"
                  rows={10}
                  defaultValue={ex.steps.map((s) => s.description).join("\n")}
                  className={`${inputCls} w-full font-mono text-xs`}
                />
              </div>
              <div className="flex items-center gap-3">
                <button type="submit" className={btnCls}>
                  Save
                </button>
              </div>
            </Form>
          </div>

          <Form
            method="post"
            className="mt-3"
            onSubmit={(e) => {
              if (!confirm(`Delete ${ex.name}?`)) e.preventDefault();
            }}
          >
            <input type="hidden" name="intent" value="delete" />
            <input type="hidden" name="exerciseId" value={ex.id} />
            <button type="submit" className={btnGhostCls}>
              delete exercise
            </button>
          </Form>
        </details>
      ))}

      <div className={cardCls}>
        <h2 className="font-semibold mb-2">Add exercise</h2>
        <Form method="post" className="space-y-2">
          <input type="hidden" name="intent" value="add" />
          <div>
            <label className={labelCls}>Name</label>
            <input name="name" required className={`${inputCls} w-full`} />
          </div>
          <div>
            <label className={labelCls}>Progression steps (one per line)</label>
            <textarea
              name="steps"
              rows={5}
              placeholder={"8kg, 8 reps\n8kg, 9 reps\n10kg, 8 reps"}
              className={`${inputCls} w-full font-mono text-xs`}
            />
          </div>
          <button type="submit" className={btnCls}>
            Add
          </button>
        </Form>
      </div>
    </div>
  );
}
