"use client";

import { MessageSquare, Plus, Trash2 } from "lucide-react";

import { useChatSession } from "@/context/ChatSessionContext";
import { cn } from "@/lib/utils";

function formatRelativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function ChatHistorySidebar() {
  const { chats, activeChatId, openChat, createChat, deleteChat } = useChatSession();

  return (
    <div className="chat-history-section">
      <div className="chat-history-header">
        <span className="section-label">
          <MessageSquare size={11} strokeWidth={2.5} />
          Chats
        </span>
        <button
          className="new-chat-btn"
          onClick={() => void createChat()}
          title="New chat"
          type="button"
        >
          <Plus size={14} strokeWidth={2.5} />
        </button>
      </div>

      {chats.length === 0 ? (
        <p className="chat-history-empty">No chats yet</p>
      ) : (
        <ul className="chat-history-list">
          {chats.map((chat) => (
            <li key={chat.id}>
              <div
                className={cn("chat-item", chat.id === activeChatId && "chat-item--active")}
                onClick={() => void openChat(chat.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && void openChat(chat.id)}
              >
                <span className="chat-item__title">{chat.title}</span>
                <span className="chat-item__time">{formatRelativeTime(chat.updatedAt)}</span>
                <button
                  className="chat-item__delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    void deleteChat(chat.id);
                  }}
                  title="Delete chat"
                  type="button"
                >
                  <Trash2 size={12} strokeWidth={2} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
