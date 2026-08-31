import { Form } from "react-router";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Field, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import type { ExercisesData } from "./exercises.server";

export function ExercisesSection({
  exercises: rows,
  error,
  savedId,
}: {
  exercises: ExercisesData;
  error: string | null;
  savedId: number | null;
}) {
  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-destructive">{error}</p>}

      {rows.map((ex) => (
        <Card key={ex.id}>
          <Form
            method="post"
            className="contents"
            onSubmit={(e) => {
              const steps = e.currentTarget.elements.namedItem("steps");
              if (
                ex.steps.length > 0 &&
                steps instanceof HTMLTextAreaElement &&
                steps.value.trim() === "" &&
                !confirm(
                  `The steps box is empty — saving deletes all ${ex.steps.length} steps of ${ex.name}. Save anyway?`,
                )
              )
                e.preventDefault();
            }}
          >
            <input type="hidden" name="intent" value="exercise-save" />
            <input type="hidden" name="exerciseId" value={ex.id} />
            <CardContent className="space-y-3">
              <Field>
                <FieldLabel htmlFor={`name-${ex.id}`}>Name</FieldLabel>
                <Input id={`name-${ex.id}`} name="name" defaultValue={ex.name} />
              </Field>
              <Field>
                <FieldLabel htmlFor={`steps-${ex.id}`}>Steps (one per line)</FieldLabel>
                <Textarea
                  id={`steps-${ex.id}`}
                  name="steps"
                  rows={8}
                  defaultValue={ex.steps.map((s) => s.description).join("\n")}
                  className="font-mono text-xs"
                />
              </Field>
              <div className="flex items-center gap-3">
                <Button type="submit">Save</Button>
                {savedId === ex.id && (
                  <span className="text-sm font-medium text-green-700 dark:text-green-400">
                    ✓ Saved
                  </span>
                )}
              </div>
            </CardContent>
          </Form>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <CardTitle>Add exercise</CardTitle>
        </CardHeader>
        <CardContent>
          <Form method="post" className="space-y-3">
            <input type="hidden" name="intent" value="exercise-add" />
            <Field>
              <FieldLabel htmlFor="add-name">Name</FieldLabel>
              <Input id="add-name" name="name" required />
            </Field>
            <Field>
              <FieldLabel htmlFor="add-steps">Progression steps (one per line)</FieldLabel>
              <Textarea
                id="add-steps"
                name="steps"
                rows={5}
                placeholder={"8kg, 8 reps\n8kg, 9 reps\n10kg, 8 reps"}
                className="font-mono text-xs"
              />
            </Field>
            <Button type="submit">Add</Button>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
