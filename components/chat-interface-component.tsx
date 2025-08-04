"use client";

import { useCallback } from "react";
import { useMounted } from "@/hooks/use-mounted";
import { Message, useChat } from "@/hooks/use-chat";
import { useAudio } from "@/hooks/use-audio";
import { useSettingsStore } from "@/lib/settings-store";
// import { useSpeechRecognitionWithDebounce } from "@/hooks/use-speech-recognition";
// import { useSpeechRecognitionWithGoogle } from "@/hooks/use-speech-recognition-google";
// import { useSpeechRecognitionWithDeepgram } from "@/hooks/use-speech-recognition-deepgram";
import { useSpeechRecognitionWithProvider } from "@/hooks/use-speech-recognition-with-provider";
import { ChatHeader } from "@/components/chat-header";
import { ChatMessages } from "@/components/chat-messages";
import { ChatInput } from "@/components/chat-input";
import { Button } from "@/components/ui/button";
import { Phone } from "lucide-react";

export function ChatInterfaceComponent() {
  const hasMounted = useMounted();
  const { messages, isLoading, sendMessage, updateMessage } = useChat();
  const { playAudio, stopAudio, isPlaying, playAudioFromUrl } = useAudio();
  const { isTtsEnabled } = useSettingsStore();

  const handleProcessMessage = useCallback(
    async (text: string) => {
      const botMessage = await sendMessage(text);
      if (botMessage && isTtsEnabled) {
        const filename = await playAudio(botMessage.content);
        if (filename) {
          updateMessage({ ...botMessage, audioFilename: filename });
        }
      }
    },
    [sendMessage, playAudio, updateMessage, isTtsEnabled]
  );

  const handleReplayAudio = useCallback(
    async (message: Message) => {
      if (message.audioFilename) {
        playAudioFromUrl(`/api/audio/${message.audioFilename}`);
      } else {
        const filename = await playAudio(message.content);
        if (filename) {
          updateMessage({ ...message, audioFilename: filename });
        }
      }
    },
    [playAudio, playAudioFromUrl, updateMessage]
  );

  const onUserSpeech = useCallback(() => {
    stopAudio();
  }, [stopAudio]);

  const {
    transcript,
    listening,
    isCalling,
    isTranscribing,
    resetTranscript,
    browserSupportsSpeechRecognition,
    startListening,
    stopListening,
    startCall,
    stopCall,
  } = useSpeechRecognitionWithProvider({
    onTranscriptComplete: handleProcessMessage,
    onUserSpeech,
    isPlaying,
  });

  const handleMicClick = useCallback(() => {
    if (listening) {
      stopListening();
    } else {
      startListening();
    }
  }, [listening, startListening, stopListening]);

  const handlePhoneClick = useCallback(() => {
    if (isCalling) {
      stopCall();
    } else {
      startCall();
    }
  }, [isCalling, startCall, stopCall]);

  const handleInputSubmit = useCallback(
    async (message: string) => {
      resetTranscript();
      await handleProcessMessage(message);
    },
    [handleProcessMessage, resetTranscript]
  );

  if (!hasMounted) return null;

  if (!browserSupportsSpeechRecognition) {
    return (
      <div className="flex flex-col h-dvh bg-white font-sans">
        <ChatHeader />
        <main className="flex-1 overflow-y-auto pt-20 pb-28">
          <div className="h-full flex items-center justify-center">
            <div className="max-w-md mx-4 text-center">
              <div className="p-8 flex flex-col items-center gap-4 text-zinc-500">
                <p className="text-red-500">
                  Sorry, your browser does not support speech recognition.
                </p>
              </div>
            </div>
          </div>
        </main>
        <ChatInput
          onSubmit={handleInputSubmit}
          transcript=""
          listening={false}
          isLoading={isLoading}
          browserSupportsSpeechRecognition={false}
          onMicClick={handleMicClick}
          isCalling={isCalling}
          isPlaying={isPlaying}
          onStopAudio={stopAudio}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-dvh bg-white font-sans">
      <ChatHeader />

      <main className="flex-1 overflow-y-auto pt-20 pb-28">
        <ChatMessages
          messages={messages}
          isLoading={isLoading}
          onReplayAudio={handleReplayAudio}
        />
      </main>

      <div className="flex flex-col items-center justify-center pb-4 w-full">
        <div className="flex items-center justify-center w-full px-4">
          <Button
            type="button"
            onClick={handlePhoneClick}
            size="icon"
            variant="ghost"
            className={`mr-2 size-9 rounded-full transition-all duration-200 ${
              isCalling
                ? "bg-red-500 hover:bg-red-600 text-white shadow-lg scale-105"
                : "bg-zinc-200 hover:bg-zinc-300 text-zinc-700 hover:scale-105"
            }`}
            aria-label={isCalling ? "End Call" : "Start Call"}
            disabled={!browserSupportsSpeechRecognition}
          >
            <Phone size={18} />
          </Button>
          <ChatInput
            onSubmit={handleInputSubmit}
            transcript={transcript}
            listening={listening}
            isLoading={isLoading || isTranscribing}
            browserSupportsSpeechRecognition={browserSupportsSpeechRecognition}
            onMicClick={handleMicClick}
            isCalling={isCalling}
            isPlaying={isPlaying}
            onStopAudio={stopAudio}
          />
        </div>

        <p className="text-xs text-zinc-400">
          Made with 🤍 by Giacomo Mantovani
        </p>
      </div>
    </div>
  );
}
