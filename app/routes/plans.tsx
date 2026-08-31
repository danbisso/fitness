import { Link } from "react-router";
import { PlansSection } from "~/sections/plans";
import { plansAction, loadPlans } from "~/sections/plans.server";
import { loadExercises } from "~/sections/exercises.server";
import type { Route } from "./+types/plans";

export async function loader() {
  const [plans, exercises] = await Promise.all([loadPlans(), loadExercises()]);
  return { plans, exercises };
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  return plansAction(form, String(form.get("intent") ?? ""));
}

export default function Plans({ loaderData, actionData }: Route.ComponentProps) {
  const error = actionData && "error" in actionData ? actionData.error : null;
  return (
    <div className="space-y-4">
      <Link
        to="/workouts"
        className="inline-block mb-4 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        ← Back to workouts
      </Link>
      <PlansSection plans={loaderData.plans} exercises={loaderData.exercises} error={error} />
    </div>
  );
}
