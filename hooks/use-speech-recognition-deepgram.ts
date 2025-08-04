import { useEffect, useRef, useState, useCallback } from "react";
import { useDebounce } from "use-debounce";
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";
import { useReactMediaRecorder } from "react-media-recorder";
import { CONFIG } from "@/lib/constants";

interface UseSpeechRecognitionWithDeepgramProps {
  onTranscriptComplete: (transcript: string) => void;
  onUserSpeech: () => void;
  debounceMs?: number;
  isPlaying: boolean;
}

export const useSpeechRecognitionWithDeepgram = ({
  onTranscriptComplete,
  onUserSpeech,
  debounceMs = CONFIG.SPEECH_DEBOUNCE_MS,
  isPlaying,
}: UseSpeechRecognitionWithDeepgramProps) => {
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

  // This ref will hold the callback that needs access to the latest state.
  const onStopCallbackRef = useRef<((blob: Blob) => void) | null>(null);

  const { startRecording, stopRecording } = useReactMediaRecorder({
    audio: {
      echoCancellation: true,
    },
      video: false,
      onStop: (blobUrl, blob) => {
        // Call the latest callback from the ref.
        if (onStopCallbackRef.current) {
          onStopCallbackRef.current(blob);
        }
      },
    });

  // Define the callback with its dependencies.
  const sendAudioForTranscription = useCallback(async (blob: Blob) => {
    setIsTranscribing(true);
    try {
      const response = await fetch("/api/stt", {
        method: "POST",
        headers: {
          "Content-Type": blob.type,
          "X-STT-Provider": "deepgram",
        },
        body: blob,
      });

      const result = await response.json();
      if (response.ok && result.data?.transcription) {
        onTranscriptComplete(result.data.transcription);
      } else {
        console.error("Failed to transcribe audio:", result.error);
      }
    } catch (error) {
      console.error("Error sending audio for transcription:", error);
    } finally {
      setIsTranscribing(false);
      resetTranscript();
      // THE FIX: Restart recording if the call is still active.
      if (isCalling) {
        startRecording();
      }
    }
  }, [isCalling, onTranscriptComplete, resetTranscript, startRecording]);

  // Update the ref with the latest callback on every render.
  useEffect(() => {
    onStopCallbackRef.current = sendAudioForTranscription;
  }, [sendAudioForTranscription]);


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
