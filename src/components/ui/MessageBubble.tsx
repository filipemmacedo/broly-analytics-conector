import dynamic from "next/dynamic";
import { Bot, User } from "lucide-react";

import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

const MetricLineChart = dynamic(
  () => import("@/components/ui/MetricLineChart").then((m) => m.MetricLineChart),
  { ssr: false }
);

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function MessageBubble({ message }: { message: ChatMessage }) {
  return (
    <article
      className={cn(
        "message-bubble",
        `message-bubble--${message.role}`,
        message.status === "error" && "message-bubble--error"
      )}
    >
      <div className="message-bubble__stamp">
        <span className="stamp-icon">
          {message.role === "user"
            ? <User size={11} strokeWidth={2.5} />
            : <Bot size={11} strokeWidth={2.5} />}
        </span>
        <span><span>{message.role === "assistant" ? "broly" : message.role}</span>
</span>
        {message.source ? <span>Tool:{message.source}</span> : null}
        <span>{formatTime(message.createdAt)}</span>
      </div>
      <div className="message-bubble__content">{message.content}</div>
      {message.chartData?.points?.length && message.chartData.points.length > 0 && (
        <MetricLineChart data={message.chartData} />
      )}
    </article>
  );
}
