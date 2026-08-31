import { Link } from "react-router";
import { ExercisesSection } from "~/sections/exercises";
import { exercisesAction, loadExercises } from "~/sections/exercises.server";
import type { Route } from "./+types/exercises";

export async function loader() {
  return { exercises: await loadExercises() };
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  return exercisesAction(form, String(form.get("intent") ?? ""));
}

export default function Exercises({ loaderData, actionData }: Route.ComponentProps) {
  const error = actionData && "error" in actionData ? actionData.error : null;
  const savedId =
    actionData && "saved" in actionData && typeof actionData.saved === "number"
      ? actionData.saved
      : null;
  return (
    <div className="space-y-4">
      <Link
        to="/workouts"
        className="inline-block mb-4 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        ← Back to workouts
      </Link>
      <ExercisesSection exercises={loaderData.exercises} error={error} savedId={savedId} />
    </div>
  );
}
