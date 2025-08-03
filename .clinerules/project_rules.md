# Project Rules: AI Language Tutor Voice Chat

## Ⅰ. Core Objective & Philosophy

**Goal**: To create a highly fluent and responsive voice-based language tutor that simulates a real phone call. The primary focus is on minimizing latency and creating a natural, interruption-friendly conversational flow.

**Core Philosophies**:
1.  **Optimism & Responsiveness**: The UI must be instantly responsive. We use local, browser-based speech detection for immediate feedback (e.g., showing a "listening" state), while delegating high-accuracy transcription to the server.
2.  **Server-Side Authority**: All core business logic, including AI chat responses and speech transcription, is handled by server-side APIs to protect credentials and ensure consistency.
3.  **Stateful Hooks as Units of Logic**: The application's functionality is modularized into custom hooks (`useChat`, `useAudio`, `useSpeechRecognitionWithGoogle`). Each hook is responsible for a distinct piece of logic and state.
4.  **Interruption is Natural**: The system is designed to handle user interruptions gracefully. If the user starts speaking, the bot's audio playback must stop immediately.

---

## Ⅱ. Architecture Overview

The application is built on a decoupled frontend-backend architecture, orchestrated primarily through custom React hooks.

1.  **`ChatInterfaceComponent`**: The central component that integrates all hooks and manages the overall UI state. It is loaded dynamically with SSR disabled (`ssr: false`) to guarantee immediate access to browser APIs (Microphone, Audio).

2.  **`useSpeechRecognitionWithGoogle` Hook (The Core of the Voice Interaction)**:
    *   **Dual-System Approach**: It uses the browser's `SpeechRecognition` API for quick, low-latency detection of speech activity and the `MediaRecorder` API to capture high-quality audio.
    *   **End-of-Speech Detection**: It uses a debounce on the browser-generated transcript to intelligently detect when a user has likely finished speaking.
    *   **Transcription Workflow**:
        1.  User speaks. Browser API provides a rough, real-time transcript.
        2.  Debounce triggers when the user pauses.
        3.  The recorded audio (as a `WEBM_OPUS` blob) is sent to the `/api/stt` endpoint.
        4.  The server-side API returns a high-accuracy transcription from Google Cloud Speech-to-Text.
        5.  The `onTranscriptComplete` callback is fired, triggering the chat logic.

3.  **API Endpoints**:
    *   `/api/stt`: Handles Speech-to-Text. Receives an audio blob and uses the official Google Cloud SDK to get a transcription. **This is the only place where Google credentials should be handled.**
    *   `/api/chat`: Handles the language model interaction. Receives user text and returns the bot's response.
    *   `/api/tts`: Handles Text-to-Speech. Receives text and returns audio data for playback.

---

## Ⅲ. Development Rules & Best Practices

### A. State Management
1.  **Hook-Local State**: All state should be co-located with its relevant logic inside a custom hook. Avoid creating complex, cross-dependent state in the main `ChatInterfaceComponent`.
2.  **Clear State Naming**: State variables must be unambiguous. For example, `isListening` should refer to the browser's speech recognition state, while `isTranscribing` refers to the server-side API call state.
3.  **Avoid Prop Drilling**: If state is needed across multiple, non-parent-child components, use Zustand for global state management. However, for the core chat functionality, the current hook-based architecture is preferred.

### B. Voice & Audio
1.  **Audio Format Consistency**: The `MediaRecorder` on the client **must** produce audio in the format expected by the `/api/stt` endpoint (`WEBM_OPUS`, 48000Hz). Any changes here must be synchronized.
2.  **Immediate Audio Interruption**: The `onUserSpeech` callback is critical. It must be implemented to immediately call `stopAudio()` from the `useAudio` hook to ensure the user can interrupt the bot naturally.
3.  **Error Handling**: The `useSpeechRecognitionWithGoogle` hook must gracefully handle API errors from the `/api/stt` endpoint and provide user feedback if transcription fails.

### C. API & Server
1.  **NEVER Expose Credentials**: Google Cloud credentials **must** only be accessed via environment variables on the server (`process.env.GOOGLE_CREDENTIALS_JSON`) within the API routes. They should never be exposed to the client.
2.  **Zod for Validation**: All API routes must validate incoming request bodies using Zod to ensure type safety and prevent errors.
3.  **Standardized API Responses**: All API routes should return a consistent JSON object, such as `{ data: T | null, error: string | null }`.

### D. Component & Code Style
1.  **Single Responsibility Principle**: Components and hooks should do one thing well. The `ChatInterfaceComponent` should focus on layout and integration, not business logic.
2.  **Use `useCallback` for Handlers**: Any function passed as a prop to a memoized component or used in a `useEffect` dependency array must be wrapped in `useCallback` to prevent unnecessary re-renders. This is critical for performance in a real-time application.
3.  **Configuration in `lib/constants.ts`**: Magic numbers or configuration values (like debounce delays, API timeouts) should be defined in `lib/constants.ts` to allow for easy tuning.

---

## Ⅳ. Project Context: How It Works

This project simulates a phone call with an AI language tutor.

**The "Call" Flow (`isCalling` mode):**
1.  User clicks the "Start Call" button, setting `isCalling` to `true`.
2.  The `useSpeechRecognitionWithGoogle` hook starts listening continuously.
3.  The user speaks. The system records.
4.  When the user pauses, the recorded audio is sent for transcription.
5.  The transcription is sent to the chat API.
6.  The AI's response is received as text.
7.  The text is sent to the TTS API to generate audio.
8.  The AI's audio response is played to the user.
9.  Crucially, the `useSpeechRecognitionWithGoogle` hook automatically starts recording again after the transcription is complete, allowing the user to respond immediately without clicking any buttons. The conversation continues until the user clicks "End Call".

**Push-to-Talk Flow (when not in a "call"):**
1.  User clicks the microphone icon.
2.  The system listens and records.
3.  User clicks the microphone icon again (or the system detects a pause).
4.  The flow proceeds from step 4 of the "Call" flow, but does not automatically restart listening.
