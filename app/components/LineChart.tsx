import { useMemo, useRef, useState } from "react";

type Point = { date: string; value: number };

const W = 640;
const H = 220;
const M = { top: 12, right: 56, bottom: 24, left: 44 };

function niceTicks(min: number, max: number, n = 4): number[] {
  if (min === max) return [min];
  const span = max - min;
  const step0 = span / n;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= n) ?? mag * 10;
  const start = Math.ceil(min / step) * step;
  const out: number[] = [];
  for (let v = start; v <= max + 1e-9; v += step) out.push(Math.round(v * 100) / 100);
  return out;
}

// Single-series time line chart: 2px line, 10% area wash, hairline solid
// gridlines, end-dot with surface ring, crosshair + tooltip on hover.
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
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const { xs, ys, ticks, path, area, sy } = useMemo(() => {
    const times = points.map((p) => Date.parse(p.date));
    const values = points.map((p) => p.value);
    const t0 = Math.min(...times);
    const t1 = Math.max(...times);
    const vMin = Math.min(...values);
    const vMax = Math.max(...values);
    const pad = (vMax - vMin || 1) * 0.1;
    const y0 = vMin - pad;
    const y1 = vMax + pad;
    const sx = (t: number) =>
      t1 === t0 ? (M.left + W - M.right) / 2 : M.left + ((t - t0) / (t1 - t0)) * (W - M.left - M.right);
    const sy = (v: number) => M.top + (1 - (v - y0) / (y1 - y0)) * (H - M.top - M.bottom);
    const xs = times.map(sx);
    const ys = values.map(sy);
    const path = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join("");
    const base = H - M.bottom;
    const area = points.length > 1 ? `${path}L${xs[xs.length - 1].toFixed(1)},${base}L${xs[0].toFixed(1)},${base}Z` : "";
    return { xs, ys, ticks: niceTicks(y0, y1), path, area, sy };
  }, [points]);

  if (points.length === 0) {
    return <p className="text-sm text-gray-400">No data for {title.toLowerCase()} yet.</p>;
  }

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = svgRef.current!.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    for (let i = 1; i < xs.length; i++) if (Math.abs(xs[i] - x) < Math.abs(xs[best] - x)) best = i;
    setHoverIdx(best);
  }

  const last = points.length - 1;
  const h = hoverIdx;
  const tipX = h != null ? Math.min(Math.max(xs[h] + 8, M.left), W - M.right - 108) : 0;
  const tipY = h != null ? Math.min(Math.max(ys[h] - 44, 4), H - M.bottom - 40) : 0;

  return (
    <div>
      <h3 className="text-sm font-semibold mb-1">
        {title} <span className="font-normal text-gray-400">({unit})</span>
      </h3>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full select-none"
        role="img"
        aria-label={`${title} over time`}
        onPointerMove={onMove}
        onPointerLeave={() => setHoverIdx(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={M.left}
              x2={W - M.right}
              y1={sy(t)}
              y2={sy(t)}
              stroke="var(--chart-grid)"
              strokeWidth="1"
            />
            <text
              x={M.left - 6}
              y={sy(t) + 3.5}
              textAnchor="end"
              fontSize="10"
              fill="var(--chart-muted)"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {t}
            </text>
          </g>
        ))}
        <text x={M.left} y={H - 6} fontSize="10" fill="var(--chart-muted)">
          {points[0].date}
        </text>
        <text x={W - M.right} y={H - 6} textAnchor="end" fontSize="10" fill="var(--chart-muted)">
          {points[last].date}
        </text>

        {area && <path d={area} fill="var(--chart-series)" opacity="0.1" />}
        <path
          d={path}
          fill="none"
          stroke="var(--chart-series)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* end dot with surface ring + direct end label */}
        <circle cx={xs[last]} cy={ys[last]} r="6" fill="var(--chart-surface)" />
        <circle cx={xs[last]} cy={ys[last]} r="4" fill="var(--chart-series)" />
        <text
          x={xs[last] + 8}
          y={ys[last] + 3.5}
          fontSize="11"
          fontWeight="600"
          fill="var(--chart-ink)"
        >
          {points[last].value}
        </text>

        {h != null && (
          <g pointerEvents="none">
            <line
              x1={xs[h]}
              x2={xs[h]}
              y1={M.top}
              y2={H - M.bottom}
              stroke="var(--chart-muted)"
              strokeWidth="1"
            />
            <circle cx={xs[h]} cy={ys[h]} r="6" fill="var(--chart-surface)" />
            <circle cx={xs[h]} cy={ys[h]} r="4" fill="var(--chart-series)" />
            <g transform={`translate(${tipX},${tipY})`}>
              <rect
                width="104"
                height="36"
                rx="6"
                fill="var(--chart-surface)"
                stroke="var(--chart-grid)"
              />
              <text x="8" y="15" fontSize="12" fontWeight="700" fill="var(--chart-ink)">
                {points[h].value} {unit}
              </text>
              <text x="8" y="29" fontSize="10" fill="var(--chart-muted)">
                {points[h].date}
              </text>
            </g>
          </g>
        )}
      </svg>
    </div>
  );
}
