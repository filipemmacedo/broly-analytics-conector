import { Bot } from "lucide-react";

import type { SseProgressStep } from "@/lib/types";

const STEP_LABELS: Record<SseProgressStep, string> = {
  planning: "Planning query…",
  querying: "Running query…",
  summarizing: "Generating summary…"
};

interface TypingIndicatorProps {
  step?: SseProgressStep | null;
}

export function TypingIndicator({ step }: TypingIndicatorProps) {
  return (
    <article className="message-bubble message-bubble--assistant">
      <div className="message-bubble__stamp">
        <span className="stamp-icon">
          <Bot size={11} strokeWidth={2.5} />
        </span>
        <span>broly</span>
      </div>
      <div className="typing-indicator">
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
        {step && <span className="typing-step-label">{STEP_LABELS[step]}</span>}
      </div>
    </article>
  );
}
