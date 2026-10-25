export const colors = {
  background: '#F6F1E7',
  surface: '#FFFCF6',
  surfaceSunken: '#EDE5D6',
  glass: 'rgba(255, 252, 246, 0.97)',
  chrome: 'rgba(246, 241, 231, 0.96)',
  border: '#DCD2C0',
  controlTrack: '#CFC5B3',
  text: '#1C2430',
  textMuted: '#5A5650',
  textDisabled: '#8C857A',
  primary: '#1D6A66',
  primaryPressed: '#155450',
  primarySoft: '#DCEAE6',
  onPrimary: '#FFFCF6',
  accent: '#A8471F',
  accentPressed: '#8A3A18',
  onAccent: '#FFFCF6',
  inverseSurface: '#1C2430',
  onInverse: '#FFFCF6',
  danger: '#A3231D',
  dangerSurface: '#A3231D',
  onDanger: '#FFFCF6',
  success: '#2C6A3A',
  warning: '#7A4F00',
  warningSurface: '#FAEBCB',
  info: '#1E5C88',
  scrim: 'rgba(28, 36, 48, 0.42)',
  mapCanvas: '#EFEBE3',
  mapAttribution: 'rgba(255, 252, 246, 0.88)',
  mapUserDot: '#2F6FED',
  mapUserDotStroke: '#FFFFFF',
  mapUserHalo: 'rgba(47, 111, 237, 0.18)',
  mapPin: '#1D6A66',
  mapPinNoPodcast: '#8C857A',
  mapPinStroke: '#FFFCF6',
  mapPinLabel: '#FFFCF6',
  mapCluster: '#1D6A66',
  mapRoute: '#A8471F',
  mapRouteCasing: '#FFFCF6',
  mapBoundaryFill: 'rgba(29, 106, 102, 0.10)',
  mapBoundaryLine: '#1D6A66',
  mapGeofenceDebug: '#D9534F',
} as const;

export const fontFamilies = {
  serifRegular: 'Newsreader_400Regular',
  serifSemiBold: 'Newsreader_600SemiBold',
  sansRegular: 'DMSans_400Regular',
  sansMedium: 'DMSans_500Medium',
  sansSemiBold: 'DMSans_600SemiBold',
  mono: 'monospace',
} as const;

export const spacing = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export const radii = { xs: 6, sm: 10, md: 14, lg: 20, xl: 28, pill: 999 } as const;

const SHADOW_INK = '28, 36, 48';

export const shadows = {
  card: { boxShadow: `0 1px 2px rgba(${SHADOW_INK}, 0.06), 0 6px 16px rgba(${SHADOW_INK}, 0.08)` },
  floating: { boxShadow: `0 1px 3px rgba(${SHADOW_INK}, 0.10), 0 8px 20px rgba(${SHADOW_INK}, 0.14)` },
  sheet: { boxShadow: `0 -1px 3px rgba(${SHADOW_INK}, 0.05), 0 -12px 32px rgba(${SHADOW_INK}, 0.12)` },
  drawer: { boxShadow: `1px 0 3px rgba(${SHADOW_INK}, 0.06), 12px 0 32px rgba(${SHADOW_INK}, 0.16)` },
} as const;

export const touchTargets = {
  minimum: 48,
  player: 56,
  playerPrimary: 72,
} as const;

export const typography = {
  wordmark: { fontFamily: fontFamilies.serifSemiBold, fontSize: 22, lineHeight: 28, letterSpacing: 1.5 },
  display: { fontFamily: fontFamilies.serifSemiBold, fontSize: 30, lineHeight: 36, letterSpacing: -0.3 },
  title: { fontFamily: fontFamilies.serifSemiBold, fontSize: 24, lineHeight: 30, letterSpacing: -0.2 },
  heading: { fontFamily: fontFamilies.serifSemiBold, fontSize: 19, lineHeight: 25 },
  reading: { fontFamily: fontFamilies.serifRegular, fontSize: 18, lineHeight: 28 },
  body: { fontFamily: fontFamilies.sansRegular, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fontFamilies.sansSemiBold, fontSize: 15, lineHeight: 22 },
  label: { fontFamily: fontFamilies.sansSemiBold, fontSize: 15, lineHeight: 20, letterSpacing: 0.2 },
  caption: { fontFamily: fontFamilies.sansRegular, fontSize: 13, lineHeight: 18 },
  captionStrong: { fontFamily: fontFamilies.sansMedium, fontSize: 13, lineHeight: 18 },
  eyebrow: { fontFamily: fontFamilies.sansSemiBold, fontSize: 11, lineHeight: 16, letterSpacing: 1.4 },
  mono: { fontFamily: fontFamilies.mono, fontSize: 11, lineHeight: 15 },
} as const;

export type ColorToken = keyof typeof colors;

export const TEXT_ON_BACKGROUND_PAIRS: [ColorToken, ColorToken][] = [
  ['text', 'background'],
  ['text', 'surface'],
  ['text', 'surfaceSunken'],
  ['text', 'primarySoft'],
  ['text', 'warningSurface'],
  ['textMuted', 'background'],
  ['textMuted', 'surface'],
  ['textMuted', 'surfaceSunken'],
  ['primary', 'background'],
  ['primary', 'surface'],
  ['primary', 'surfaceSunken'],
  ['primary', 'primarySoft'],
  ['onPrimary', 'primary'],
  ['onPrimary', 'primaryPressed'],
  ['accent', 'background'],
  ['accent', 'surface'],
  ['accent', 'surfaceSunken'],
  ['onAccent', 'accent'],
  ['onAccent', 'accentPressed'],
  ['onInverse', 'inverseSurface'],
  ['danger', 'background'],
  ['danger', 'surface'],
  ['onDanger', 'dangerSurface'],
  ['success', 'surface'],
  ['warning', 'warningSurface'],
  ['info', 'surface'],
  ['mapPinLabel', 'mapCluster'],
];

export const NON_TEXT_PAIRS: [ColorToken, ColorToken][] = [
  ['textDisabled', 'surface'],
  ['mapPin', 'mapCanvas'],
  ['mapRoute', 'mapCanvas'],
  ['mapBoundaryLine', 'mapCanvas'],
  ['mapUserDot', 'mapCanvas'],
];

export const fill = { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 } as const;
