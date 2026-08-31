import { useState } from "react";
import { Form, data } from "react-router";
import { eq } from "drizzle-orm";
import { db } from "~/db";
import { gutLogs } from "~/db/schema";
import { LineChart } from "~/components/LineChart";
import { LoadMoreSentinel, pageCount } from "~/components/LoadMore";
import { Button } from "~/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Field, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { DateField, utcToday } from "~/lib/ui";
import { fieldErrors, gutLogInsert } from "~/lib/validation";
import type { Route } from "./+types/gut";

export async function loader({ request }: Route.LoaderArgs) {
  // Charts need the full history (for "All time"); only the entry list is
  // paginated. Chart payload is trimmed to {date, value} pairs.
  const rows = await db.query.gutLogs.findMany({
    orderBy: (g, { desc }) => [desc(g.date), desc(g.id)],
  });
  const count = pageCount(request);
  const asc = [...rows].reverse();
  return {
    logs: rows.slice(0, count),
    hasMore: rows.length > count,
    weightPoints: asc
      .filter((l) => l.weightKg != null)
      .map((l) => ({ date: l.date, value: l.weightKg! })),
    waistPoints: asc
      .filter((l) => l.waistCm != null)
      .map((l) => ({ date: l.date, value: l.waistCm! })),
    today: utcToday(),
  };
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  if (form.get("intent") === "delete") {
    await db.delete(gutLogs).where(eq(gutLogs.id, Number(form.get("id"))));
    return { ok: true };
  }
  const parsed = gutLogInsert.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    return data({ errors: fieldErrors(parsed.error) }, { status: 400 });
  }
  await db.insert(gutLogs).values(parsed.data);
  return { ok: true };
}

const RANGES = [
  { key: "90d", label: "Last 90 days", days: 90 },
  { key: "1y", label: "Last year", days: 365 },
  { key: "all", label: "All time", days: null },
] as const;

export default function Gut({ loaderData, actionData }: Route.ComponentProps) {
  const errors =
    actionData && "errors" in actionData ? actionData.errors : null;
  const { logs, hasMore, weightPoints, waistPoints } = loaderData;
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("1y");
  const days = RANGES.find((r) => r.key === range)!.days;
  const cutoff = days
    ? new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
    : null;
  const inRange = (p: { date: string }) => !cutoff || p.date >= cutoff;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent>
          <Form method="post" className="grid gap-3 sm:grid-cols-5 items-end">
            <Field>
              <FieldLabel>Date</FieldLabel>
              <DateField serverToday={loaderData.today} />
            </Field>
            <Field>
              <FieldLabel htmlFor="weightKg">Weight (kg)</FieldLabel>
              <Input id="weightKg" type="number" step="0.1" name="weightKg" />
            </Field>
            <Field>
              <FieldLabel htmlFor="waistCm">Waist (cm)</FieldLabel>
              <Input id="waistCm" type="number" step="0.5" name="waistCm" />
            </Field>
            <div className="sm:col-span-2 flex gap-2 items-end">
              <Field className="grow">
                <FieldLabel htmlFor="gut-notes">Notes</FieldLabel>
                <Input id="gut-notes" type="text" name="notes" placeholder="what happened this period" />
              </Field>
              <Button type="submit">Log</Button>
            </div>
          </Form>
          {errors && (
            <p className="mt-2 text-sm text-destructive">
              {Object.values(errors).flat().join(" · ")}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-1">
        {RANGES.map((r) => (
          <Button
            key={r.key}
            variant={range === r.key ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setRange(r.key)}
          >
            {r.label}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent>
          <LineChart title="Weight" unit="kg" points={weightPoints.filter(inRange)} />
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <LineChart title="Waist" unit="cm" points={waistPoints.filter(inRange)} />
        </CardContent>
      </Card>

      {logs.length === 0 && (
        <p className="text-sm text-muted-foreground">Nothing logged yet.</p>
      )}
      {logs.map((l) => (
        <Card key={l.id} size="sm">
          <CardHeader>
            <CardTitle>{l.date}</CardTitle>
            <CardAction>
              <Form
                method="post"
                onSubmit={(e) => {
                  if (!confirm("Delete this entry?")) e.preventDefault();
                }}
              >
                <input type="hidden" name="intent" value="delete" />
                <input type="hidden" name="id" value={l.id} />
                <Button type="submit" variant="ghost" size="xs" className="text-muted-foreground hover:text-destructive">
                  delete
                </Button>
              </Form>
            </CardAction>
          </CardHeader>
          <CardContent className="text-sm">
            <div className="flex gap-6" style={{ fontVariantNumeric: "tabular-nums" }}>
              <span>
                <span className="text-muted-foreground">Weight </span>
                {l.weightKg != null ? `${l.weightKg} kg` : "—"}
              </span>
              <span>
                <span className="text-muted-foreground">Waist </span>
                {l.waistCm != null ? `${l.waistCm} cm` : "—"}
              </span>
            </div>
            {l.notes && <p className="mt-1 text-muted-foreground">{l.notes}</p>}
          </CardContent>
        </Card>
      ))}

      <LoadMoreSentinel hasMore={hasMore} loaded={logs.length} />
    </div>
  );
}
