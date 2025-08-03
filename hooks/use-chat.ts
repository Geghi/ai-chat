import { useState, useCallback } from "react";
import { useAliasStore } from "@/lib/alias-store";
import { useSettingsStore } from "@/lib/settings-store";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  audioFilename?: string;
}

export const useChat = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { aliases } = useAliasStore();
  const { interests, language } = useSettingsStore();

  const sendMessage = useCallback(
    async (text: string): Promise<Message | null> => {
      if (!text.trim() || isLoading) return null;

      const userMessage: Message = {
        id: Date.now().toString(),
        role: "user",
        content: text,
      };

      const newMessages: Message[] = [...messages, userMessage];
      const last5Messages = newMessages.slice(-6, -1);

      setMessages(newMessages);
      setIsLoading(true);

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            message: text,
            aliases,
            history: last5Messages,
            interests,
            language,
          }),
        });
        const result = await response.json();

        if (!response.ok || result.error) {
          throw new Error(result.error || "Failed to generate response");
        }

        const botMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: result.data.content,
          // audioFilename will be added after TTS playback
        };

        setMessages((prev) => [...prev, botMessage]);
        return botMessage;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("An unknown error occurred");
        console.error("Error generating response:", err);
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: error.message,
        };

        setMessages((prev) => [...prev, errorMessage]);
        return errorMessage;
      } finally {
        setIsLoading(false);
      }
    },
    [aliases, isLoading, messages, interests, language],
  );

  const updateMessage = useCallback((updatedMessage: Message) => {
    setMessages((prevMessages) =>
      prevMessages.map((msg) =>
        msg.id === updatedMessage.id ? updatedMessage : msg
      )
    );
  }, []);

  return {
    messages,
    isLoading,
    sendMessage,
    updateMessage,
  };
};
