import type { ReactNode } from "react";
import { Form } from "react-router";
import { LoadMoreSentinel } from "~/components/LoadMore";
import { Button } from "~/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Field, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { DateField, RESULT_OPTIONS } from "~/lib/ui";
import type { HistoryData } from "./history.server";

export const resultItems = RESULT_OPTIONS.map((r) => ({
  value: r.value,
  label: `${r.emoji} ${r.value}`,
}));

// One exercise's fields, shared by the intake form and the edit form. `suffix`
// is what the field names are keyed by (exercise id when logging, entry id
// when editing).
export function ExerciseFields({
  suffix,
  steps,
  step,
  result,
  notes,
}: {
  suffix: number;
  steps: string[];
  step: string | null;
  result: string | null;
  notes?: string | null;
}) {
  // A snapshotted step may no longer be in the progression; keep it selectable.
  const options = step && !steps.includes(step) ? [step, ...steps] : steps;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <Field>
        <FieldLabel>Progression</FieldLabel>
        <Select name={`step-${suffix}`} defaultValue={step ?? undefined}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel>How did it feel?</FieldLabel>
        <Select
          name={`result-${suffix}`}
          defaultValue={result ?? "Skipped"}
          items={resultItems}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {resultItems.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field className="col-span-2 sm:col-span-1">
        <FieldLabel>Notes</FieldLabel>
        <Input
          type="text"
          name={`notes-${suffix}`}
          placeholder="optional"
          defaultValue={notes ?? ""}
        />
      </Field>
    </div>
  );
}

export function HistorySection({
  workouts: rows,
  hasMore,
  editingId,
  onEdit,
  errorText,
}: {
  workouts: HistoryData["workouts"];
  hasMore: boolean;
  editingId: number | null;
  onEdit: (id: number | null) => void;
  errorText: ReactNode;
}) {
  return (
    <div className="space-y-4">
      {rows.length === 0 && (
        <p className="text-sm text-muted-foreground">No workouts logged yet.</p>
      )}
      {rows.map((w) =>
        editingId === w.id ? (
          <Card key={w.id}>
            <CardContent>
              <Form method="post" className="space-y-4">
                <input type="hidden" name="intent" value="update-workout" />
                <input type="hidden" name="id" value={w.id} />
                <div className="flex items-end justify-between gap-4 flex-wrap">
                  <Field className="w-auto">
                    <FieldLabel>Date</FieldLabel>
                    <DateField defaultValue={w.date} />
                  </Field>
                  <span className="pb-2 text-sm font-medium">{w.plan.name}</span>
                </div>
                {w.entries.map((e) => (
                  <div key={e.id} className="border-t pt-4 space-y-3">
                    <h3 className="font-medium">{e.exercise.name}</h3>
                    <ExerciseFields
                      suffix={e.id}
                      steps={e.exercise.steps.map((s) => s.description)}
                      step={e.stepDescription}
                      result={e.result}
                      notes={e.notes}
                    />
                  </div>
                ))}
                <div className="flex gap-1.5">
                  <Button type="submit">Save</Button>
                  <Button type="button" variant="outline" onClick={() => onEdit(null)}>
                    Cancel
                  </Button>
                </div>
              </Form>
              {errorText}
            </CardContent>
          </Card>
        ) : (
          <Card key={w.id}>
            <CardHeader>
              <CardTitle>
                {w.plan.name}
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {w.date}
                </span>
              </CardTitle>
              <CardAction className="flex items-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => onEdit(w.id)}
                >
                  edit
                </Button>
                <Form
                  method="post"
                  onSubmit={(e) => {
                    if (!confirm("Delete this workout?")) e.preventDefault();
                  }}
                >
                  <input type="hidden" name="intent" value="delete-workout" />
                  <input type="hidden" name="id" value={w.id} />
                  <Button type="submit" variant="ghost" size="xs" className="text-muted-foreground hover:text-destructive">
                    delete
                  </Button>
                </Form>
              </CardAction>
            </CardHeader>
            <CardContent>
              {/* mobile: stacked per entry; sm+: aligned fifths grid (1/5 ×3 + 2/5) */}
              <ul className="divide-y divide-border text-sm">
                {w.entries.map((e) => {
                  const resultCls =
                    e.result === "Felt good!"
                      ? "text-green-700 dark:text-green-400"
                      : e.result
                        ? "text-amber-700 dark:text-amber-400"
                        : "text-muted-foreground";
                  return (
                    <li
                      key={e.id}
                      className="py-2 sm:grid sm:grid-cols-[1fr_1fr_1fr_2fr] sm:gap-x-3"
                    >
                      <div className="flex items-baseline justify-between gap-2 sm:block">
                        <span className="font-medium break-words">{e.exercise.name}</span>
                        <span className={`${resultCls} sm:hidden shrink-0`}>
                          {e.result ?? "skipped"}
                        </span>
                      </div>
                      <div className="text-foreground/80 break-words">
                        {e.stepDescription}
                      </div>
                      <div className={`hidden sm:block break-words ${resultCls}`}>
                        {e.result ?? "skipped"}
                      </div>
                      {e.notes && (
                        <div className="text-muted-foreground break-words">
                          {e.notes}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        ),
      )}

      <LoadMoreSentinel hasMore={hasMore} loaded={rows.length} />
    </div>
  );
}
