"use client";

import dynamic from "next/dynamic";

const ChatInterfaceComponent = dynamic(
  () =>
    import("./chat-interface-component").then(
      (mod) => mod.ChatInterfaceComponent
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col h-dvh bg-white font-sans">
        <div className="flex-1 flex items-center justify-center">
          <p>Loading...</p>
        </div>
      </div>
    ),
  }
);

export function ChatInterface() {
  return <ChatInterfaceComponent />;
}
