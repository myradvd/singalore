import { DISTANCE_UNITS, PODCAST_LENGTH_CLASSES, WALKING_PACES } from '@singalore/shared';
import { PLAYBACK_RATES, type Preferences } from '@/modules/prefs/preferencesSchema';
import type { IconName } from '../../primitives/Icon';

type KeysOfType<Value> = { [Key in keyof Preferences]: Preferences[Key] extends Value ? Key : never }[keyof Preferences];

export interface ChoiceOption<Value>
{
  label: string;
  value: Value;
}

export type PreferenceField =
  | { kind: 'toggle'; key: KeysOfType<boolean>; label: string; description: string; disabledReason?: string }
  | { kind: 'choice'; key: 'walkingPace'; label: string; options: ChoiceOption<Preferences['walkingPace']>[] }
  | { kind: 'choice'; key: 'distanceUnit'; label: string; options: ChoiceOption<Preferences['distanceUnit']>[] }
  | { kind: 'choice'; key: 'playbackRate'; label: string; options: ChoiceOption<number>[] }
  | { kind: 'choice'; key: 'preferredLength'; label: string; options: ChoiceOption<Preferences['preferredLength']>[] }
  | { kind: 'catalogChoice'; key: 'preferredVoice' | 'preferredAccent'; label: string; source: 'voice' | 'accent' };

export const SECTION_IDS = ['audio', 'route', 'notifications'] as const;
export type SectionId = (typeof SECTION_IDS)[number];

export interface PreferenceSection
{
  id: SectionId;
  title: string;
  subtitle: string;
  icon: IconName;
  fields: PreferenceField[];
}

const capitalise = (text: string): string => `${text.charAt(0).toUpperCase()}${text.slice(1)}`;

export const NOT_AVAILABLE_ROUTING = 'Not available yet: the walking route service has no data for this.';
export const NOT_AVAILABLE_PUSH = 'Not available yet: new episode alerts need a push service.';
export const NOT_AVAILABLE_RECOMMENDATIONS = 'Not available yet: recommendations are not built in this version.';

export const PREFERENCE_SECTIONS: PreferenceSection[] = [
  {
    id: 'audio',
    title: 'Audio and podcasts',
    subtitle: 'Triggers, autoplay, voice and speed',
    icon: 'headphones',
    fields: [
      { kind: 'toggle', key: 'geofenceTriggersEnabled', label: 'Podcast prompts near sites', description: 'Offer a podcast when you walk into range of a heritage site' },
      { kind: 'toggle', key: 'autoplayEnabled', label: 'Autoplay', description: 'Start the podcast without asking when you arrive' },
      { kind: 'catalogChoice', key: 'preferredVoice', label: 'Preferred voice', source: 'voice' },
      { kind: 'catalogChoice', key: 'preferredAccent', label: 'Preferred accent', source: 'accent' },
      { kind: 'choice', key: 'preferredLength', label: 'Preferred length', options: [{ label: 'Any', value: null }, ...PODCAST_LENGTH_CLASSES.map((value) => ({ label: capitalise(value), value }))] },
      { kind: 'choice', key: 'playbackRate', label: 'Playback speed', options: PLAYBACK_RATES.map((value) => ({ label: `${value}x`, value })) },
    ],
  },
  {
    id: 'route',
    title: 'Route',
    subtitle: 'Walking pace and units',
    icon: 'walk',
    fields: [
      { kind: 'choice', key: 'walkingPace', label: 'Walking pace', options: WALKING_PACES.map((value) => ({ label: capitalise(value), value })) },
      { kind: 'choice', key: 'distanceUnit', label: 'Distance units', options: DISTANCE_UNITS.map((value) => ({ label: value === 'metric' ? 'Kilometres' : 'Miles', value })) },
      { kind: 'toggle', key: 'avoidSteepInclines', label: 'Avoid steep inclines', description: 'Prefer flatter paths', disabledReason: NOT_AVAILABLE_ROUTING },
      { kind: 'toggle', key: 'preferCoveredRoutes', label: 'Prefer covered walkways', description: 'Prefer sheltered paths', disabledReason: NOT_AVAILABLE_ROUTING },
    ],
  },
  {
    id: 'notifications',
    title: 'Notifications',
    subtitle: 'Arrivals, route and download alerts',
    icon: 'bell-outline',
    fields: [
      { kind: 'toggle', key: 'notifyArrivals', label: 'Arrival alerts', description: 'Notify me when I reach a site with the app in the background' },
      { kind: 'toggle', key: 'notifyRouteUpdates', label: 'Route updates', description: 'Off-route warnings and tour completion' },
      { kind: 'toggle', key: 'notifyDownloads', label: 'Downloads', description: 'Tell me when a park download finishes or fails' },
      { kind: 'toggle', key: 'notifyNewEpisodes', label: 'New episodes', description: 'Tell me about new podcasts', disabledReason: NOT_AVAILABLE_PUSH },
    ],
  },
];

export function isSectionId(value: unknown): value is SectionId
{
  return typeof value === 'string' && (SECTION_IDS as readonly string[]).includes(value);
}

export function sectionKeys(section: PreferenceSection): (keyof Preferences)[]
{
  return section.fields.map((field) => field.key);
}

export function isDirty(section: PreferenceSection, saved: Preferences, draft: Preferences): boolean
{
  return sectionKeys(section).some((key) => JSON.stringify(saved[key]) !== JSON.stringify(draft[key]));
}
