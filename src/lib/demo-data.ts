import type {
  BigQueryConnection,
  BigQueryMetadata,
  ExecutionResult,
  PlannedExecution,
  PowerBIConnection,
  PowerBIMetadata
} from "@/lib/types";

export const demoBigQueryMetadata: BigQueryMetadata = {
  projects: [
    {
      id: "demo-commerce",
      datasets: [
        {
          id: "sales_warehouse",
          location: "EU",
          tables: [
            {
              id: "orders",
              description: "Order level facts",
              columns: [
                { name: "order_id", type: "STRING" },
                { name: "order_date", type: "DATE" },
                { name: "country", type: "STRING" },
                { name: "channel", type: "STRING" },
                { name: "revenue", type: "NUMERIC" }
              ]
            },
            {
              id: "sessions",
              description: "Website session facts",
              columns: [
                { name: "session_date", type: "DATE" },
                { name: "source", type: "STRING" },
                { name: "sessions", type: "INTEGER" },
                { name: "users", type: "INTEGER" }
              ]
            },
            {
              id: "customers",
              description: "Customer dimension",
              columns: [
                { name: "customer_id", type: "STRING" },
                { name: "country", type: "STRING" },
                { name: "segment", type: "STRING" }
              ]
            }
          ]
        }
      ]
    }
  ]
};

export const demoPowerBIMetadata: PowerBIMetadata = {
  workspaces: [
    {
      id: "workspace-growth-ops",
      name: "Growth Ops",
      datasets: [
        {
          id: "dataset-executive-kpis",
          name: "Executive KPI Model",
          tables: [
            { name: "Revenue", type: "measure" },
            { name: "Orders", type: "measure" },
            { name: "Users", type: "measure" },
            { name: "Country", type: "dimension" },
            { name: "Channel", type: "dimension" }
          ]
        }
      ],
      reports: [
        {
          id: "report-executive-overview",
          name: "Executive Overview",
          embedUrl: "https://app.powerbi.com/reportEmbed?reportId=report-executive-overview"
        }
      ]
    }
  ]
};

export function buildDemoBigQueryConnection(): BigQueryConnection {
  return {
    status: "demo",
    mode: "demo",
    selected: {
      projectId: "demo-commerce",
      datasetId: "sales_warehouse",
      tableId: "orders"
    },
    metadata: demoBigQueryMetadata,
    connectedAt: new Date().toISOString(),
    lastSyncedAt: new Date().toISOString()
  };
}

export function buildDemoPowerBIConnection(): PowerBIConnection {
  return {
    status: "demo",
    mode: "demo",
    selected: {
      workspaceId: "workspace-growth-ops",
      datasetId: "dataset-executive-kpis",
      reportId: "report-executive-overview"
    },
    metadata: demoPowerBIMetadata,
    connectedAt: new Date().toISOString(),
    lastSyncedAt: new Date().toISOString()
  };
}

export function runDemoPlan(plan: PlannedExecution): ExecutionResult {
  const normalized = plan.question.toLowerCase();

  if (plan.source === "bigquery") {
    if (normalized.includes("revenue") || normalized.includes("sales")) {
      return {
        answer: "BigQuery shows 128,400 EUR in revenue for the selected demo range.",
        preview: [{ metric: "Revenue", value: 128400, currency: "EUR" }]
      };
    }

    if (normalized.includes("order")) {
      return {
        answer: "BigQuery shows 924 orders in the selected demo range.",
        preview: [{ metric: "Orders", value: 924 }]
      };
    }

    if (normalized.includes("country")) {
      return {
        answer: "Portugal is the top country in the demo warehouse slice.",
        preview: [
          { country: "Portugal", revenue: 58400 },
          { country: "Spain", revenue: 33200 },
          { country: "France", revenue: 21450 }
        ]
      };
    }

    if (
      normalized.includes("what tables") ||
      normalized.includes("available tables") ||
      normalized.includes("list tables")
    ) {
      return {
        answer: "The active demo BigQuery dataset contains orders, sessions, and customers.",
        preview: [
          { table: "orders", purpose: "Order facts" },
          { table: "sessions", purpose: "Traffic facts" },
          { table: "customers", purpose: "Customer dimension" }
        ]
      };
    }

    return {
      answer:
        "BigQuery demo mode can answer revenue, orders, top country, and table inventory questions right now.",
      preview: [{ supported: "revenue" }, { supported: "orders" }, { supported: "top country" }]
    };
  }

  if (normalized.includes("revenue") || normalized.includes("sales")) {
    return {
      answer: "Power BI reports 126,900 EUR from the Executive KPI Model for the selected demo range.",
      preview: [{ metric: "Revenue", value: 126900, currency: "EUR" }],
      report: {
        id: "report-executive-overview",
        name: "Executive Overview",
        embedUrl: "https://app.powerbi.com/reportEmbed?reportId=report-executive-overview"
      }
    };
  }

  if (normalized.includes("users") || normalized.includes("sessions")) {
    return {
      answer: "Power BI shows 18,320 users in the selected demo model.",
      preview: [{ metric: "Users", value: 18320 }],
      report: {
        id: "report-executive-overview",
        name: "Executive Overview",
        embedUrl: "https://app.powerbi.com/reportEmbed?reportId=report-executive-overview"
      }
    };
  }

  if (normalized.includes("report") || normalized.includes("dashboard")) {
    return {
      answer: "The active Power BI workspace contains the Executive Overview report.",
      preview: [{ report: "Executive Overview", dataset: "Executive KPI Model" }],
      report: {
        id: "report-executive-overview",
        name: "Executive Overview",
        embedUrl: "https://app.powerbi.com/reportEmbed?reportId=report-executive-overview"
      }
    };
  }

  return {
    answer:
      "Power BI demo mode can answer revenue, users, and report inventory questions right now.",
    preview: [
      { supported: "revenue" },
      { supported: "users" },
      { supported: "report inventory" }
    ],
    report: {
      id: "report-executive-overview",
      name: "Executive Overview",
      embedUrl: "https://app.powerbi.com/reportEmbed?reportId=report-executive-overview"
    }
  };
}
