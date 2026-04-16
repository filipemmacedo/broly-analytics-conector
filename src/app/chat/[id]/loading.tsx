import { ChatRouteLoader } from "@/components/chat/ChatRouteLoader";

export default function ChatLoading() {
  return (
    <div className="editorial-app">
      <div className="analysis-panel chat-route-loading-page">
        <div className="analysis-stage">
          <ChatRouteLoader />
        </div>
      </div>
    </div>
  );
}
