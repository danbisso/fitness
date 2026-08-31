import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "~/components/ui/chart";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const config = {
  curr: { label: "This week", color: "var(--chart-1)" },
  prev: { label: "Last week", color: "var(--chart-3)" },
} satisfies ChartConfig;

// Grouped bars: one pair per weekday (Mon-start) — last week vs this week.
export function WeekBarChart({ prev, curr }: { prev: number[]; curr: number[] }) {
  const data = DAY_LABELS.map((day, i) => ({ day, prev: prev[i], curr: curr[i] }));

  return (
    <div>
      <h3 className="text-sm font-semibold mb-1">Calories by weekday</h3>
      <ChartContainer config={config} className="aspect-auto h-55 w-full">
        <BarChart data={data}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar dataKey="prev" fill="var(--color-prev)" radius={4} />
          <Bar dataKey="curr" fill="var(--color-curr)" radius={4} />
        </BarChart>
      </ChartContainer>
    </div>
  );
}
