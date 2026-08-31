import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "~/components/ui/chart";

type Point = { date: string; value: number };

// Single-series time line chart (gut log weight/waist) on shadcn charts.
// The data table rendered elsewhere on the page is the no-hover fallback.
export function LineChart({
  title,
  unit,
  points,
}: {
  title: string;
  unit: string;
  points: Point[];
}) {
  if (points.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No data for {title.toLowerCase()} yet.
      </p>
    );
  }

  const config = {
    value: { label: `${title} (${unit})`, color: "var(--chart-1)" },
  } satisfies ChartConfig;

  return (
    <div>
      <h3 className="text-sm font-semibold mb-1">
        {title} <span className="font-normal text-muted-foreground">({unit})</span>
      </h3>
      <ChartContainer config={config} className="aspect-auto h-55 w-full">
        <AreaChart data={points} margin={{ left: 0, right: 28, top: 6 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={48}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={40}
            domain={["auto", "auto"]}
            tickFormatter={(v: number) => v.toLocaleString("en-US")}
          />
          <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
          <Area
            dataKey="value"
            type="monotone"
            fill="var(--color-value)"
            fillOpacity={0.1}
            stroke="var(--color-value)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </AreaChart>
      </ChartContainer>
    </div>
  );
}
