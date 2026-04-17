import { Bot } from "lucide-react";

export function TypingIndicator() {
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
      </div>
    </article>
  );
}
