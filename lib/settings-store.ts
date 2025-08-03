import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface SettingsState {
  interests: string[];
  language: string;
  isTtsEnabled: boolean;
  setInterests: (interests: string[]) => void;
  setLanguage: (language: string) => void;
  setIsTtsEnabled: (isTtsEnabled: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(persist(
  (set) => ({
    interests: [],
    language: 'en-US',
    isTtsEnabled: true,
    setInterests: (interests: string[]) => set({ interests }),
    setLanguage: (language: string) => set({ language }),
    setIsTtsEnabled: (isTtsEnabled: boolean) => set({ isTtsEnabled }),
  }),
  {
    name: 'voice-agent-settings-storage',
    storage: createJSONStorage(() => localStorage),
    migrate: (persistedState: unknown) => {
      const state = persistedState as Partial<SettingsState>;
      state.interests = state.interests || [];
      state.language = state.language || 'en-US';
      state.isTtsEnabled = state.isTtsEnabled === undefined ? true : state.isTtsEnabled;
      return state;
    },
  }
));
