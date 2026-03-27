import type { PlannedExecution, SessionState, SourceId } from "@/lib/types";

function deriveFilters(question: string) {
  const normalized = question.toLowerCase();

  if (normalized.includes("last 7")) {
    return ["Date range: last 7 days"];
  }
  if (normalized.includes("last 30")) {
    return ["Date range: last 30 days"];
  }
  if (normalized.includes("last quarter")) {
    return ["Date range: last quarter"];
  }
  return ["Date range: last 30 days"];
}

function inferSource(question: string, session: SessionState): SourceId | null {
  if (session.activeSource) {
    return session.activeSource;
  }

  const normalized = question.toLowerCase();
  const bigQueryConnected = session.connections.bigquery.status !== "disconnected";
  const powerBiConnected = session.connections.powerbi.status !== "disconnected";

  if (normalized.includes("bigquery") || normalized.includes("sql") || normalized.includes("table")) {
    return "bigquery";
  }
  if (
    normalized.includes("power bi") ||
    normalized.includes("dashboard") ||
    normalized.includes("report") ||
    normalized.includes("semantic")
  ) {
    return "powerbi";
  }
  if (bigQueryConnected && !powerBiConnected) {
    return "bigquery";
  }
  if (powerBiConnected && !bigQueryConnected) {
    return "powerbi";
  }
  return null;
}

function buildBigQueryPlan(question: string, session: SessionState): PlannedExecution {
  const projectId =
    session.connections.bigquery.selected.projectId ??
    session.connections.bigquery.metadata.projects[0]?.id ??
    "demo-commerce";
  const datasetId =
    session.connections.bigquery.selected.datasetId ??
    session.connections.bigquery.metadata.projects[0]?.datasets[0]?.id ??
    "sales_warehouse";
  const tableId =
    session.connections.bigquery.selected.tableId ??
    session.connections.bigquery.metadata.projects[0]?.datasets[0]?.tables[0]?.id ??
    "orders";
  const filters = deriveFilters(question);
  const normalized = question.toLowerCase();

  if (normalized.includes("what tables") || normalized.includes("available tables") || normalized.includes("list tables")) {
    return {
      source: "bigquery",
      question,
      intent: "table_inventory",
      queryLanguage: "sql",
      queryText: `SELECT table_name FROM \`${projectId}.${datasetId}.INFORMATION_SCHEMA.TABLES\` ORDER BY table_name`,
      context: [`Project: ${projectId}`, `Dataset: ${datasetId}`],
      filters
    };
  }

  if (normalized.includes("country")) {
    return {
      source: "bigquery",
      question,
      intent: "top_country",
      queryLanguage: "sql",
      queryText: `SELECT country, SUM(revenue) AS revenue FROM \`${projectId}.${datasetId}.${tableId}\` GROUP BY country ORDER BY revenue DESC LIMIT 5`,
      context: [`Project: ${projectId}`, `Dataset: ${datasetId}`, `Table: ${tableId}`],
      filters
    };
  }

  if (normalized.includes("revenue") || normalized.includes("sales")) {
    return {
      source: "bigquery",
      question,
      intent: "revenue_summary",
      queryLanguage: "sql",
      queryText: `SELECT SUM(revenue) AS revenue FROM \`${projectId}.${datasetId}.${tableId}\` WHERE order_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)`,
      context: [`Project: ${projectId}`, `Dataset: ${datasetId}`, `Table: ${tableId}`],
      filters
    };
  }

  if (normalized.includes("order")) {
    return {
      source: "bigquery",
      question,
      intent: "orders_summary",
      queryLanguage: "sql",
      queryText: `SELECT COUNT(*) AS orders FROM \`${projectId}.${datasetId}.${tableId}\` WHERE order_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)`,
      context: [`Project: ${projectId}`, `Dataset: ${datasetId}`, `Table: ${tableId}`],
      filters
    };
  }

  return {
    source: "bigquery",
    question,
    intent: "unsupported",
    queryLanguage: "sql",
    queryText: `SELECT * FROM \`${projectId}.${datasetId}.${tableId}\` LIMIT 10`,
    context: [`Project: ${projectId}`, `Dataset: ${datasetId}`, `Table: ${tableId}`],
    filters
  };
}

function buildPowerBIPlan(question: string, session: SessionState): PlannedExecution {
  const workspace =
    session.connections.powerbi.metadata.workspaces.find(
      (item) => item.id === session.connections.powerbi.selected.workspaceId
    ) ?? session.connections.powerbi.metadata.workspaces[0];
  const dataset =
    workspace?.datasets.find((item) => item.id === session.connections.powerbi.selected.datasetId) ??
    workspace?.datasets[0];
  const filters = deriveFilters(question);
  const normalized = question.toLowerCase();

  if (normalized.includes("report") || normalized.includes("dashboard") || normalized.includes("available reports")) {
    return {
      source: "powerbi",
      question,
      intent: "report_inventory",
      queryLanguage: "system",
      queryText: `List reports in workspace ${workspace?.name ?? "selected workspace"}`,
      context: [`Workspace: ${workspace?.name ?? "Unknown workspace"}`],
      filters
    };
  }

  if (normalized.includes("users") || normalized.includes("sessions")) {
    return {
      source: "powerbi",
      question,
      intent: "users_summary",
      queryLanguage: "dax",
      queryText: "EVALUATE ROW(\"Users\", [Users])",
      context: [
        `Workspace: ${workspace?.name ?? "Unknown workspace"}`,
        `Dataset: ${dataset?.name ?? "Unknown dataset"}`
      ],
      filters
    };
  }

  return {
    source: "powerbi",
    question,
    intent: "revenue_summary",
    queryLanguage: "dax",
    queryText: "EVALUATE ROW(\"Revenue\", [Revenue])",
    context: [
      `Workspace: ${workspace?.name ?? "Unknown workspace"}`,
      `Dataset: ${dataset?.name ?? "Unknown dataset"}`
    ],
    filters
  };
}

export function planExecution(question: string, session: SessionState): PlannedExecution {
  const source = inferSource(question, session);

  if (!source) {
    return {
      source: "bigquery",
      clarification:
        "I can answer this from BigQuery or Power BI. Choose the source first so I do not guess.",
      question,
      intent: "clarification",
      queryLanguage: "system",
      queryText: "Source selection required",
      context: [],
      filters: []
    };
  }

  return source === "bigquery" ? buildBigQueryPlan(question, session) : buildPowerBIPlan(question, session);
}
