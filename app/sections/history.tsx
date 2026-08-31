import { Form } from "react-router";
import { LoadMoreSentinel } from "~/components/LoadMore";
import { Button } from "~/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import type { HistoryData } from "./history.server";

export function HistorySection({
  workouts: rows,
  hasMore,
}: {
  workouts: HistoryData["workouts"];
  hasMore: boolean;
}) {
  return (
    <div className="space-y-4">
      {rows.length === 0 && (
        <p className="text-muted-foreground">No workouts logged yet.</p>
      )}
      {rows.map((w) => (
        <Card key={w.id}>
          <CardHeader>
            <CardTitle>
              {w.plan.name}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {w.date}
              </span>
            </CardTitle>
            <CardAction>
              <Form
                method="post"
                onSubmit={(e) => {
                  if (!confirm("Delete this workout? Progression pointers are not rewound."))
                    e.preventDefault();
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
      ))}

      <LoadMoreSentinel hasMore={hasMore} loaded={rows.length} />
    </div>
  );
}
