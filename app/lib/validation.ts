import { z } from "zod";
import { createInsertSchema } from "drizzle-zod";
import { foodLogs, gutLogs } from "~/db/schema";

// FormData values are strings; "" on an optional numeric field means "not
// provided". Coerce manually (z.coerce would turn null into 0).
const optionalNumber = z.preprocess(
  (v) => (v == null || (typeof v === "string" && v.trim() === "") ? null : Number(v)),
  z.number().nullable(),
);

const rowId = z.coerce.number().int().positive();

const dateYMD = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

const emptyToNull = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? null : v),
  z.string().nullable(),
);

export const gutLogInsert = createInsertSchema(gutLogs, {
  date: dateYMD,
  weightKg: optionalNumber,
  waistCm: optionalNumber,
  notes: emptyToNull,
}).omit({ id: true });

export const gutLogUpdate = gutLogInsert.extend({ id: rowId });

export const foodLogInsert = createInsertSchema(foodLogs, {
  date: dateYMD,
  food: z.string().trim().min(1, "What did you eat?"),
  calories: z.preprocess(
    (v) => (v == null || (typeof v === "string" && v.trim() === "") ? null : Number(v)),
    z.number().int().min(0).nullable(),
  ),
}).omit({ id: true });

export const foodLogUpdate = foodLogInsert.extend({ id: rowId });

// Workout edit: header fields only; per-entry fields are keyed by entry id
// (`step-<id>`, `result-<id>`, `notes-<id>`) and read off the form directly.
export const workoutUpdate = z.object({ id: rowId, date: dateYMD });

export const dailyTargetUpdate = z.object({
  target: z.coerce.number().int().min(1, "Enter a daily calorie target"),
});

// Flattened field errors in a shape routes can return from actions.
export function fieldErrors(error: z.ZodError) {
  return z.flattenError(error).fieldErrors as Record<string, string[]>;
}
