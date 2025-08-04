import { useEffect, useRef, useState, useCallback } from "react";
import { useDebounce } from "use-debounce";
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";
import { useReactMediaRecorder } from "react-media-recorder";
import { CONFIG } from "@/lib/constants";
import { useSettingsStore } from "@/lib/settings-store";

interface UseSpeechRecognitionProps {
  onTranscriptComplete: (transcript: string) => void;
  onUserSpeech: () => void;
  debounceMs?: number;
  isPlaying: boolean;
}

export const useSpeechRecognitionWithProvider = ({
  onTranscriptComplete,
  onUserSpeech,
  debounceMs = CONFIG.SPEECH_DEBOUNCE_MS,
  isPlaying,
}: UseSpeechRecognitionProps) => {
  const { transcriptionProvider } = useSettingsStore();
  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition,
  } = useSpeechRecognition();

  const [debouncedTranscript] = useDebounce(transcript, debounceMs);
  const lastProcessedTranscript = useRef<string>("");
  const [isCalling, setIsCalling] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const onStopCallbackRef = useRef<((blob: Blob) => void) | null>(null);

  const { startRecording, stopRecording } = useReactMediaRecorder({
    audio: {
      echoCancellation: true,
    },
    video: false,
    onStop: (blobUrl, blob) => {
      if (onStopCallbackRef.current) {
        onStopCallbackRef.current(blob);
      }
    },
  });

  const handleTranscriptionResponse = useCallback(async (response: Response, provider: string) => {
    const result = await response.json();
    if (response.ok && result.data?.transcription) {
      onTranscriptComplete(result.data.transcription);
    } else {
      console.error(`Failed to transcribe audio with ${provider}:`, result.error);
    }
  }, [onTranscriptComplete]);

  const transcribeWithGoogle = useCallback(async (blob: Blob) => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = async () => {
      const base64Audio = (reader.result as string).split(",")[1];
      const response = await fetch("/api/stt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-STT-Provider": "google",
        },
        body: JSON.stringify({ audio: base64Audio }),
      });
      await handleTranscriptionResponse(response, "Google");
    };
  }, [handleTranscriptionResponse]);

  const transcribeWithDeepgram = useCallback(async (blob: Blob) => {
    const response = await fetch("/api/stt", {
      method: "POST",
      headers: {
        "Content-Type": blob.type,
        "X-STT-Provider": "deepgram",
      },
      body: blob,
    });
    await handleTranscriptionResponse(response, "Deepgram");
  }, [handleTranscriptionResponse]);

  const sendAudio = useCallback(async (blob: Blob) => {
    setIsTranscribing(true);
    try {
      if (transcriptionProvider === "google") {
        await transcribeWithGoogle(blob);
      } else {
        await transcribeWithDeepgram(blob);
      }
    } catch (error) {
      console.error("Error sending audio for transcription:", error);
    } finally {
      setIsTranscribing(false);
      resetTranscript();
      if (isCalling) {
        startRecording();
      }
    }
  }, [isCalling, resetTranscript, startRecording, transcriptionProvider, transcribeWithGoogle, transcribeWithDeepgram]);

  useEffect(() => {
    onStopCallbackRef.current = sendAudio;
  }, [sendAudio]);


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
      stopRecording(); // This will trigger onStop and send the audio
      if (!isCalling) {
        SpeechRecognition.stopListening();
      }
    }
  }, [
    debouncedTranscript,
    listening,
    isCalling,
    stopRecording,
  ]);

  const startListening = useCallback(() => {
    resetTranscript();
    lastProcessedTranscript.current = "";
    startRecording();
    SpeechRecognition.startListening({
      continuous: true,
    });
  }, [resetTranscript, startRecording]);

  const stopListening = useCallback(() => {
    if (listening) {
      SpeechRecognition.stopListening();
      stopRecording();
    }
  }, [listening, stopRecording]);

  const startCall = useCallback(() => {
    setIsCalling(true);
    startListening();
  }, [startListening]);

  const stopCall = useCallback(() => {
    setIsCalling(false);
    stopListening();
  }, [stopListening]);

  return {
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
  };
};
