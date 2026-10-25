import { create } from 'zustand';
import { DEFAULT_PREFERENCES, type Preferences } from './preferencesSchema';
import type { PreferencesRepository } from './PreferencesRepository';

interface PreferencesState
{
  preferences: Preferences;
  loaded: boolean;
}

export const usePreferencesStore = create<PreferencesState>(() => ({ preferences: DEFAULT_PREFERENCES, loaded: false }));

export function getPreferences(): Preferences
{
  return usePreferencesStore.getState().preferences;
}

export async function loadPreferences(repository: PreferencesRepository): Promise<Preferences>
{
  const preferences = await repository.load();
  usePreferencesStore.setState({ preferences, loaded: true });
  return preferences;
}

export async function updatePreferences(repository: PreferencesRepository, changes: Partial<Preferences>): Promise<void>
{
  await repository.save(changes);
  usePreferencesStore.setState((state) => ({ preferences: { ...state.preferences, ...changes } }));
}

export async function resetPreferences(repository: PreferencesRepository): Promise<void>
{
  await repository.reset();
  usePreferencesStore.setState({ preferences: DEFAULT_PREFERENCES });
}
