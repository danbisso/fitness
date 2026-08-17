import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  layout("routes/layout.tsx", [
    index("routes/workout.tsx"),
    route("workouts", "routes/workouts.tsx"),
    route("exercises", "routes/exercises.tsx"),
    route("plans", "routes/plans.tsx"),
    route("gut", "routes/gut.tsx"),
    route("food", "routes/food.tsx"),
  ]),
] satisfies RouteConfig;
