import type { PreferencesRepository } from './PreferencesRepository';
import { getPreferences, updatePreferences } from './preferencesStore';

export const MAX_STORED_RECENT_SITES = 20;

// Puts the added sites in front, newest last in the batch, without duplicates, capped at the limit.
export function withRecentSites(current: readonly string[], addedSiteIds: readonly string[]): string[]
{
  const merged = addedSiteIds.reduce<string[]>((list, siteId) => [siteId, ...list.filter((id) => id !== siteId)], [...current]);
  return merged.slice(0, MAX_STORED_RECENT_SITES);
}

// Saves selected sites to the on device list of recent sites.
export async function recordRecentSites(repository: PreferencesRepository, addedSiteIds: readonly string[]): Promise<void>
{
  if (addedSiteIds.length > 0)
  {
    await updatePreferences(repository, { recentSiteIds: withRecentSites(getPreferences().recentSiteIds, addedSiteIds) });
  }
}

// Removes every saved recent site.
export async function clearRecentSites(repository: PreferencesRepository): Promise<void>
{
  await updatePreferences(repository, { recentSiteIds: [] });
}
