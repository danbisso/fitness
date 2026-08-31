import { useState } from "react";
import { Form } from "react-router";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

import type { PlansData } from "./plans.server";

function PlanActionButton({
  plan,
}: {
  plan: { id: number; name: string; archived: boolean; workoutCount: number };
}) {
  if (plan.workoutCount === 0 && !plan.archived) {
    return (
      <Form
        method="post"
        onSubmit={(e) => {
          if (!confirm(`Delete ${plan.name}?`)) e.preventDefault();
        }}
      >
        <input type="hidden" name="intent" value="plan-delete" />
        <input type="hidden" name="planId" value={plan.id} />
        <Button type="submit" variant="ghost" size="xs" className="text-muted-foreground hover:text-destructive">
          delete plan
        </Button>
      </Form>
    );
  }
  return (
    <Form
      method="post"
      onSubmit={(e) => {
        if (
          !plan.archived &&
          !confirm(`Archive ${plan.name}? It leaves the rotation; its history stays.`)
        )
          e.preventDefault();
      }}
    >
      <input
        type="hidden"
        name="intent"
        value={plan.archived ? "plan-unarchive" : "plan-archive"}
      />
      <input type="hidden" name="planId" value={plan.id} />
      <Button type="submit" variant="ghost" size="xs" className="text-muted-foreground hover:text-foreground">
        {plan.archived ? "unarchive" : "archive"}
      </Button>
    </Form>
  );
}

export function PlansSection({
  plans: rows,
  exercises,
  error,
}: {
  plans: PlansData;
  exercises: { id: number; name: string }[];
  error: string | null;
}) {
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const active = rows.filter((p) => !p.archived);
  const archived = rows.filter((p) => p.archived);
  const byName = [...exercises].sort((a, b) => a.name.localeCompare(b.name));

  const renderCard = (p: PlansData[number]) => {
    const available = byName
      .filter((e) => !p.planExercises.some((pe) => pe.exerciseId === e.id))
      .map((e) => ({ value: String(e.id), label: e.name }));
    return (
      <Card key={p.id}>
        <CardHeader>
          {renamingId === p.id ? (
            <Form
              method="post"
              className="flex gap-2"
              onSubmit={() => setRenamingId(null)}
            >
              <input type="hidden" name="intent" value="plan-rename" />
              <input type="hidden" name="planId" value={p.id} />
              <Input name="name" defaultValue={p.name} required autoFocus className="max-w-48" />
              <Button type="submit" size="sm">
                Save
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setRenamingId(null)}>
                Cancel
              </Button>
            </Form>
          ) : (
            <CardTitle className={p.archived ? "text-muted-foreground" : undefined}>
              {p.name}
              <button
                type="button"
                className="ml-2 text-xs font-normal text-muted-foreground underline underline-offset-2 hover:text-foreground"
                onClick={() => setRenamingId(p.id)}
              >
                edit
              </button>
            </CardTitle>
          )}
          <CardAction>
            <PlanActionButton plan={p} />
          </CardAction>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border">
            {p.planExercises.map((pe) => (
              <li key={pe.id} className="flex items-center justify-between py-1.5 text-sm">
                <span>
                  {pe.position}. {pe.exercise.name}
                </span>
                {!p.archived && (
                  <Form method="post">
                    <input type="hidden" name="intent" value="plan-remove-exercise" />
                    <input type="hidden" name="planExerciseId" value={pe.id} />
                    <Button type="submit" variant="ghost" size="xs" className="text-muted-foreground hover:text-destructive">
                      remove
                    </Button>
                  </Form>
                )}
              </li>
            ))}
          </ul>
          {!p.archived && (
            <Form method="post" className="mt-2 flex gap-2">
              <input type="hidden" name="intent" value="plan-add-exercise" />
              <input type="hidden" name="planId" value={p.id} />
              <Select
                name="exerciseId"
                items={available}
                defaultValue={available[0]?.value}
              >
                <SelectTrigger className="min-w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {available.map((e) => (
                    <SelectItem key={e.value} value={e.value}>
                      {e.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="submit">Add exercise</Button>
            </Form>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Workouts alternate through the active plans in order.
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}

      {active.map(renderCard)}

      <Card>
        <CardHeader>
          <CardTitle>Add plan</CardTitle>
        </CardHeader>
        <CardContent>
          <Form method="post" className="flex gap-2">
            <input type="hidden" name="intent" value="plan-add" />
            <Input name="name" required placeholder="Workout C" className="max-w-48" />
            <Button type="submit">Add</Button>
          </Form>
        </CardContent>
      </Card>

      {archived.length > 0 && (
        <>
          <h3 className="pt-2 text-sm font-semibold text-muted-foreground">
            Archived plans
          </h3>
          {archived.map(renderCard)}
        </>
      )}
    </div>
  );
}
