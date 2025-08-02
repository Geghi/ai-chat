import { useEffect, useRef, useState, useCallback } from "react";
import { useDebounce } from "use-debounce";
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";
import { useReactMediaRecorder } from "react-media-recorder";
import { CONFIG } from "@/lib/constants";

interface UseSpeechRecognitionWithGoogleProps {
  onTranscriptComplete: (transcript: string) => void;
  onUserSpeech: () => void;
  debounceMs?: number;
  isPlaying: boolean;
}

export const useSpeechRecognitionWithGoogle = ({
  onTranscriptComplete,
  onUserSpeech,
  debounceMs = CONFIG.SPEECH_DEBOUNCE_MS,
  isPlaying,
}: UseSpeechRecognitionWithGoogleProps) => {
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

  const { status, startRecording, stopRecording, mediaBlobUrl } =
    useReactMediaRecorder({
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
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64Audio = (reader.result as string).split(",")[1];
        const response = await fetch("/api/stt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ audio: base64Audio }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.transcription) {
            onTranscriptComplete(data.transcription);
          }
        } else {
          console.error("Failed to transcribe audio");
        }
      };
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

  const startListening = () => {
    resetTranscript();
    lastProcessedTranscript.current = "";
    startRecording();
    SpeechRecognition.startListening({
      continuous: true,
    });
  };

  const stopListening = () => {
    if (listening) {
      SpeechRecognition.stopListening();
      stopRecording();
    }
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
    isTranscribing,
    resetTranscript,
    browserSupportsSpeechRecognition,
    startListening,
    stopListening,
    startCall,
    stopCall,
  };
};
