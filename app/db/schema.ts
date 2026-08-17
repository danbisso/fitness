import { sqliteTable, integer, text, real } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

// An exercise, e.g. "Barbell Squat". Its progression is a freeform ordered
// list of steps ("25lb × 5", "8kg, 9 reps", "Decline, 8 reps", ...).
// currentStepId points at the load to use next time the exercise comes up.
export const exercises = sqliteTable("exercises", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  currentStepId: integer("current_step_id"),
});

export const progressionSteps = sqliteTable("progression_steps", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  exerciseId: integer("exercise_id")
    .notNull()
    .references(() => exercises.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  description: text("description").notNull(),
});

// A workout plan, e.g. "Workout A". Workouts alternate between plans.
export const plans = sqliteTable("plans", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  position: integer("position").notNull(),
});

export const planExercises = sqliteTable("plan_exercises", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  planId: integer("plan_id")
    .notNull()
    .references(() => plans.id, { onDelete: "cascade" }),
  exerciseId: integer("exercise_id")
    .notNull()
    .references(() => exercises.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
});

// A logged workout session.
export const workouts = sqliteTable("workouts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  planId: integer("plan_id")
    .notNull()
    .references(() => plans.id),
  date: text("date").notNull(), // YYYY-MM-DD
});

export const workoutEntries = sqliteTable("workout_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  workoutId: integer("workout_id")
    .notNull()
    .references(() => workouts.id, { onDelete: "cascade" }),
  exerciseId: integer("exercise_id")
    .notNull()
    .references(() => exercises.id),
  stepDescription: text("step_description").notNull(), // load performed, snapshotted
  result: text("result"), // "Felt good!" | "Missed rep(s)" | ...
  notes: text("notes"),
});

export const gutLogs = sqliteTable("gut_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(), // YYYY-MM-DD
  weightKg: real("weight_kg"),
  waistCm: real("waist_cm"),
  notes: text("notes"),
});

export const foodLogs = sqliteTable("food_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(), // YYYY-MM-DD
  food: text("food").notNull(),
});

export const exercisesRelations = relations(exercises, ({ many }) => ({
  steps: many(progressionSteps),
}));

export const progressionStepsRelations = relations(
  progressionSteps,
  ({ one }) => ({
    exercise: one(exercises, {
      fields: [progressionSteps.exerciseId],
      references: [exercises.id],
    }),
  }),
);

export const plansRelations = relations(plans, ({ many }) => ({
  planExercises: many(planExercises),
}));

export const planExercisesRelations = relations(planExercises, ({ one }) => ({
  plan: one(plans, {
    fields: [planExercises.planId],
    references: [plans.id],
  }),
  exercise: one(exercises, {
    fields: [planExercises.exerciseId],
    references: [exercises.id],
  }),
}));

export const workoutsRelations = relations(workouts, ({ one, many }) => ({
  plan: one(plans, {
    fields: [workouts.planId],
    references: [plans.id],
  }),
  entries: many(workoutEntries),
}));

export const workoutEntriesRelations = relations(workoutEntries, ({ one }) => ({
  workout: one(workouts, {
    fields: [workoutEntries.workoutId],
    references: [workouts.id],
  }),
  exercise: one(exercises, {
    fields: [workoutEntries.exerciseId],
    references: [exercises.id],
  }),
}));
