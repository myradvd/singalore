import type { CatalogPodcast } from '@singalore/shared';

export interface PodcastPreferences
{
  preferredVoice: string | null;
  preferredAccent: string | null;
  preferredLength: 'short' | 'standard' | 'long' | null;
}

export function pickPodcast(podcasts: readonly CatalogPodcast[], preferences: PodcastPreferences): CatalogPodcast | null
{
  if (podcasts.length === 0)
  {
    return null;
  }
  const scored = podcasts.map((podcast, index) =>
  {
    let score = 0;
    if (preferences.preferredAccent !== null && podcast.accent === preferences.preferredAccent)
    {
      score += 4;
    }
    if (preferences.preferredVoice !== null && podcast.voice === preferences.preferredVoice)
    {
      score += 2;
    }
    if (preferences.preferredLength !== null && podcast.lengthClass === preferences.preferredLength)
    {
      score += 1;
    }
    return { podcast, score, index };
  });
  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  return scored[0]?.podcast ?? null;
}

export function availableVariantOptions(podcasts: readonly CatalogPodcast[]): { voices: string[]; accents: string[]; lengths: string[] }
{
  const unique = (values: (string | null)[]) => [...new Set(values.filter((value): value is string => value !== null))].sort();
  return {
    voices: unique(podcasts.map((podcast) => podcast.voice)),
    accents: unique(podcasts.map((podcast) => podcast.accent)),
    lengths: unique(podcasts.map((podcast) => podcast.lengthClass)),
  };
}
