"use client";

import type { TableData } from "@/lib/types";

interface MetricTableProps {
  data: TableData;
}

const numberFormatter = new Intl.NumberFormat();

function formatCell(value: string | number): string {
  return typeof value === "number" ? numberFormatter.format(value) : value;
}

export function MetricTable({ data }: MetricTableProps) {
  if (!data.rows.length) return null;

  const firstRow = data.rows[0];
  const isMetric = (col: string) => typeof firstRow[col] === "number";

  return (
    <div className="metric-table">
      <table className="metric-table__table">
        <thead>
          <tr>
            {data.columns.map((col) => (
              <th
                key={col}
                className={isMetric(col) ? "metric-table__th--metric" : "metric-table__th--dimension"}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, i) => (
            <tr key={i} className="metric-table__row">
              {data.columns.map((col) => (
                <td
                  key={col}
                  className={isMetric(col) ? "metric-table__td--metric" : "metric-table__td--dimension"}
                >
                  {formatCell(row[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
