import { Dashboard } from "@/components/dashboard";
import { ChatSessionProvider } from "@/context/ChatSessionContext";

export default function HomePage() {
  return (
    <ChatSessionProvider>
      <Dashboard />
    </ChatSessionProvider>
  );
}
