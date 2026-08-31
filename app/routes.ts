import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  layout("routes/layout.tsx", [
    index("routes/food.tsx"),
    route("workouts", "routes/workout.tsx"),
    route("exercises", "routes/exercises.tsx"),
    route("plans", "routes/plans.tsx"),
    route("gut", "routes/gut.tsx"),
  ]),
] satisfies RouteConfig;
