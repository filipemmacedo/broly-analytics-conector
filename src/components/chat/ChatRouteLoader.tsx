export function ChatRouteLoader() {
  const lineWidths = ["82%", "74%", "88%", "66%", "79%", "60%", "71%"];

  return (
    <div className="chat-route-loader" aria-live="polite" aria-busy="true">
      <div className="chat-route-loader__header" />
      <div className="chat-route-loader__body">
        {lineWidths.map((width, index) => (
          <div
            key={width}
            className="chat-route-loader__line"
            style={{ width, animationDelay: `${index * 80}ms` }}
          />
        ))}
      </div>
      <div className="chat-route-loader__lights" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <span className="sr-only">Loading chat</span>
    </div>
  );
}
