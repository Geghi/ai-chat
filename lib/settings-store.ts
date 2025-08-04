import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

type TranscriptionProvider = "google" | "deepgram";

interface SettingsState {
  interests: string[];
  language: string;
  isTtsEnabled: boolean;
  transcriptionProvider: TranscriptionProvider;
  setInterests: (interests: string[]) => void;
  setLanguage: (language: string) => void;
  setIsTtsEnabled: (isTtsEnabled: boolean) => void;
  setTranscriptionProvider: (provider: TranscriptionProvider) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      interests: [],
      language: "en-US",
      isTtsEnabled: true,
      transcriptionProvider: "deepgram", // Default provider
      setInterests: (interests: string[]) => set({ interests }),
      setLanguage: (language: string) => set({ language }),
      setIsTtsEnabled: (isTtsEnabled: boolean) => set({ isTtsEnabled }),
      setTranscriptionProvider: (provider: TranscriptionProvider) =>
        set({ transcriptionProvider: provider }),
    }),
  {
    name: 'voice-agent-settings-storage',
    storage: createJSONStorage(() => localStorage),
    migrate: (persistedState: unknown) => {
      const state = persistedState as Partial<SettingsState>;
      // Set default values for new fields
      if (!state.transcriptionProvider) {
        state.transcriptionProvider = "deepgram";
      }
      return state as SettingsState;
    },
  }
));
