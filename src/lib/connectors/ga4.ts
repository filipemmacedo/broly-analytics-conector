// GA4 Data API connector — executes structured report requests against
// https://analyticsdata.googleapis.com/v1beta/{propertyId}:runReport

// ─── Metadata ────────────────────────────────────────────────────────────────

interface GA4MetadataItem {
  apiName: string;
  uiName: string;
  description?: string;
}

interface GA4MetadataResponse {
  metrics?: GA4MetadataItem[];
  dimensions?: GA4MetadataItem[];
}

export interface GA4PropertyMetadata {
  metrics: GA4MetadataItem[];
  dimensions: GA4MetadataItem[];
}

// In-memory cache keyed by propertyId — metadata is stable within a session
const metadataCache = new Map<string, GA4PropertyMetadata>();

export async function getGA4Metadata(
  accessToken: string,
  propertyId: string
): Promise<GA4PropertyMetadata> {
  const cached = metadataCache.get(propertyId);
  if (cached) return cached;

  const response = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/${propertyId}/metadata`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!response.ok) {
    // Non-fatal — return empty metadata and let the LLM use its training knowledge
    return { metrics: [], dimensions: [] };
  }

  const data = (await response.json()) as GA4MetadataResponse;
  const result: GA4PropertyMetadata = {
    metrics: data.metrics ?? [],
    dimensions: data.dimensions ?? []
  };

  metadataCache.set(propertyId, result);
  return result;
}

export function formatMetadataForPrompt(metadata: GA4PropertyMetadata): string {
  if (!metadata.metrics.length && !metadata.dimensions.length) return "";

  const metricLines = metadata.metrics.map(
    (m) => `  ${m.apiName} (${m.uiName})${m.description ? ": " + m.description : ""}`
  );
  const dimensionLines = metadata.dimensions.map(
    (d) => `  ${d.apiName} (${d.uiName})${d.description ? ": " + d.description : ""}`
  );

  return [
    "Available metrics for this property:",
    ...metricLines,
    "",
    "Available dimensions for this property:",
    ...dimensionLines
  ].join("\n");
}

export interface GA4Metric {
  name: string;
}

export interface GA4Dimension {
  name: string;
}

export interface GA4DateRange {
  startDate: string;
  endDate: string;
}

export interface GA4OrderBy {
  metric?: { metricName: string };
  dimension?: { dimensionName: string };
  desc?: boolean;
}

export interface GA4ReportParams {
  metrics: GA4Metric[];
  dimensions?: GA4Dimension[];
  dateRanges?: GA4DateRange[];
  orderBys?: GA4OrderBy[];
  limit?: number;
  dimensionFilter?: unknown;
  metricFilter?: unknown;
}

interface GA4DimensionHeader { name: string }
interface GA4MetricHeader { name: string; type: string }
interface GA4DimensionValue { value: string }
interface GA4MetricValue { value: string }
interface GA4Row {
  dimensionValues?: GA4DimensionValue[];
  metricValues?: GA4MetricValue[];
}

interface GA4ReportResponse {
  dimensionHeaders?: GA4DimensionHeader[];
  metricHeaders?: GA4MetricHeader[];
  rows?: GA4Row[];
  rowCount?: number;
}

function formatRowsAsMarkdownTable(
  dimensionHeaders: GA4DimensionHeader[],
  metricHeaders: GA4MetricHeader[],
  rows: GA4Row[]
): string {
  const headers = [
    ...dimensionHeaders.map((h) => h.name),
    ...metricHeaders.map((h) => h.name)
  ];

  const separator = headers.map(() => "---").join(" | ");
  const headerRow = headers.join(" | ");

  const dataRows = rows.map((row) => {
    const dimValues = (row.dimensionValues ?? []).map((v) => v.value);
    const metValues = (row.metricValues ?? []).map((v) => v.value);
    return [...dimValues, ...metValues].join(" | ");
  });

  return [headerRow, separator, ...dataRows].join("\n");
}

export async function runGA4Report(
  accessToken: string,
  propertyId: string,
  params: GA4ReportParams
): Promise<string> {
  const url = `https://analyticsdata.googleapis.com/v1beta/${propertyId}:runReport`;

  const body: Record<string, unknown> = {
    metrics: params.metrics,
  };
  if (params.dimensions?.length) body.dimensions = params.dimensions;
  if (params.dateRanges?.length) body.dateRanges = params.dateRanges;
  if (params.orderBys?.length) body.orderBys = params.orderBys;
  if (params.limit) body.limit = params.limit;
  if (params.dimensionFilter) body.dimensionFilter = params.dimensionFilter;
  if (params.metricFilter) body.metricFilter = params.metricFilter;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const text = await response.text();
    let message = `GA4 API error ${response.status}`;
    try {
      const parsed = JSON.parse(text) as { error?: { message?: string } };
      if (parsed.error?.message) message = parsed.error.message;
    } catch {
      // use raw text if not JSON
      if (text) message = text.slice(0, 300);
    }
    throw new Error(message);
  }

  const data = (await response.json()) as GA4ReportResponse;

  const dimensionHeaders = data.dimensionHeaders ?? [];
  const metricHeaders = data.metricHeaders ?? [];
  const rows = data.rows ?? [];

  if (rows.length === 0) {
    return "No data found for the requested dimensions and date range.";
  }

  return formatRowsAsMarkdownTable(dimensionHeaders, metricHeaders, rows);
}
