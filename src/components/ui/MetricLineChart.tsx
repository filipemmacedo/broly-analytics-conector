"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import type { ChartData } from "@/lib/types";

export function normaliseGA4Date(raw: string): string {
  // GA4 returns dates as YYYYMMDD — convert to YYYY-MM-DD
  if (raw.length === 8 && /^\d{8}$/.test(raw)) {
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  }
  return raw;
}

const LINE_COLORS = [
  "#6366f1", // indigo
  "#f59e0b", // amber
  "#10b981", // emerald
  "#ef4444", // red
  "#8b5cf6", // violet
];

interface MetricLineChartProps {
  data: ChartData;
}

export function MetricLineChart({ data }: MetricLineChartProps) {
  if (!data.points.length) return null;

  const isMulti = data.metrics.length > 1;

  return (
    <div className="metric-line-chart">
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data.points} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid, #e5e7eb)" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={48}
          />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6 }} labelStyle={{ fontWeight: 600 }} />
          {isMulti && <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />}
          {data.metrics.map((metric, i) => (
            <Line
              key={metric}
              type="monotone"
              dataKey={metric}
              stroke={LINE_COLORS[i % LINE_COLORS.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
