import { Form } from "react-router";
import { eq } from "drizzle-orm";
import { db } from "~/db";
import { workouts } from "~/db/schema";
import { btnGhostCls, cardCls } from "~/lib/ui";
import type { Route } from "./+types/workouts";

export async function loader() {
  const rows = await db.query.workouts.findMany({
    orderBy: (w, { desc }) => [desc(w.date), desc(w.id)],
    with: {
      plan: true,
      entries: { with: { exercise: true } },
    },
  });
  return { workouts: rows };
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const id = Number(form.get("id"));
  await db.delete(workouts).where(eq(workouts.id, id));
  return { ok: true };
}

export default function History({ loaderData }: Route.ComponentProps) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Workout history</h1>
      {loaderData.workouts.length === 0 && (
        <p className="text-gray-500">No workouts logged yet.</p>
      )}
      {loaderData.workouts.map((w) => (
        <div key={w.id} className={cardCls}>
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold">
              {w.plan.name}
              <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                {w.date}
              </span>
            </h2>
            <Form
              method="post"
              onSubmit={(e) => {
                if (!confirm("Delete this workout? Progression pointers are not rewound."))
                  e.preventDefault();
              }}
            >
              <input type="hidden" name="id" value={w.id} />
              <button type="submit" className={btnGhostCls}>
                delete
              </button>
            </Form>
          </div>
          <table className="mt-2 w-full text-sm">
            <tbody>
              {w.entries.map((e) => (
                <tr
                  key={e.id}
                  className="border-t border-gray-100 dark:border-gray-800"
                >
                  <td className="py-1.5 pr-3 font-medium">{e.exercise.name}</td>
                  <td className="py-1.5 pr-3 text-gray-600 dark:text-gray-300">
                    {e.stepDescription}
                  </td>
                  <td className="py-1.5 pr-3">
                    <span
                      className={
                        e.result === "Felt good!"
                          ? "text-green-700 dark:text-green-400"
                          : e.result
                            ? "text-amber-700 dark:text-amber-400"
                            : "text-gray-400"
                      }
                    >
                      {e.result ?? "skipped"}
                    </span>
                  </td>
                  <td className="py-1.5 text-gray-500 dark:text-gray-400">
                    {e.notes}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
