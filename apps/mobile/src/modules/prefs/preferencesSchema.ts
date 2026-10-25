import { DISTANCE_UNITS, LANDMARK_CATEGORIES, PODCAST_LENGTH_CLASSES, WALKING_PACES } from '@singalore/shared';
import { z } from 'zod';

export const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 2] as const;

export const PreferenceShapes = {
  geofenceTriggersEnabled: z.boolean().default(true),
  autoplayEnabled: z.boolean().default(false),
  preferredVoice: z.string().nullable().default(null),
  preferredAccent: z.string().nullable().default(null),
  preferredLength: z.enum(PODCAST_LENGTH_CLASSES).nullable().default(null),
  playbackRate: z.number().min(0.5).max(2).default(1),
  walkingPace: z.enum(WALKING_PACES).default('normal'),
  distanceUnit: z.enum(DISTANCE_UNITS).default('metric'),
  avoidSteepInclines: z.boolean().default(false),
  preferCoveredRoutes: z.boolean().default(false),
  recommendationCategories: z.array(z.enum(LANDMARK_CATEGORIES)).default([...LANDMARK_CATEGORIES]),
  nearbyRadiusMeters: z.number().int().min(100).max(5000).default(500),
  notifyRouteUpdates: z.boolean().default(true),
  notifyNewEpisodes: z.boolean().default(false),
  notifyDownloads: z.boolean().default(true),
  notifyArrivals: z.boolean().default(true),
  downloadOverWifiOnly: z.boolean().default(true),
  mapBaseLayer: z.enum(['standard', 'satellite']).default('standard'),
  showHeritageBoundaries: z.boolean().default(true),
  apiBaseUrlOverride: z.string().nullable().default(null),
} as const;

export const PreferencesSchema = z.object(PreferenceShapes);
export type Preferences = z.infer<typeof PreferencesSchema>;
export type PreferenceKey = keyof Preferences;

export const DEFAULT_PREFERENCES: Preferences = PreferencesSchema.parse({});
