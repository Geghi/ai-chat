import { useEffect, useRef, useState } from "react";
import { useDebounce } from "use-debounce";
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";
import { CONFIG } from "@/lib/constants";

interface UseSpeechRecognitionWithDebounceProps {
  onTranscriptComplete: (transcript: string) => void;
  onUserSpeech: () => void;
  debounceMs?: number;
  isPlaying: boolean;
}

export const useSpeechRecognitionWithDebounce = ({
  onTranscriptComplete,
  onUserSpeech,
  debounceMs = CONFIG.SPEECH_DEBOUNCE_MS,
  isPlaying,
}: UseSpeechRecognitionWithDebounceProps) => {
  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition,
  } = useSpeechRecognition();

  const [debouncedTranscript] = useDebounce(transcript, debounceMs);
  const lastProcessedTranscript = useRef<string>("");
  const [isCalling, setIsCalling] = useState(false);

  useEffect(() => {
    if (transcript && isPlaying) {
      onUserSpeech();
    }
  }, [transcript, isPlaying, onUserSpeech]);

  useEffect(() => {
    if (
      debouncedTranscript &&
      debouncedTranscript !== lastProcessedTranscript.current &&
      listening
    ) {
      lastProcessedTranscript.current = debouncedTranscript;
      onTranscriptComplete(debouncedTranscript);
      resetTranscript();
      if (!isCalling) {
        SpeechRecognition.stopListening();
      }
    }
  }, [
    debouncedTranscript,
    listening,
    onTranscriptComplete,
    resetTranscript,
    isCalling,
  ]);

  const startListening = () => {
    resetTranscript();
    lastProcessedTranscript.current = "";
    SpeechRecognition.startListening({
      continuous: true,
      // @ts-ignore
      echoCancellation: true,
    });
  };

  const stopListening = () => {
    SpeechRecognition.stopListening();
  };

  const startCall = () => {
    setIsCalling(true);
    startListening();
  };

  const stopCall = () => {
    setIsCalling(false);
    stopListening();
  };

  return {
    transcript,
    listening,
    isCalling,
    resetTranscript,
    browserSupportsSpeechRecognition,
    startListening,
    stopListening,
    startCall,
    stopCall,
  };
};
