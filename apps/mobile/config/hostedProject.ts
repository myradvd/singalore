import { z } from 'zod';

const HostedProjectSchema = z.object({
  apiBaseUrl: z.url({ protocol: /^https$/ }).nullable(),
  easProjectId: z.uuid().nullable(),
});

export type HostedProject = z.infer<typeof HostedProjectSchema>;

// The shared online backend and Expo project for the whole team. Both values are public, not secrets.
// The owner fills them in once (QUICKSTART.md, part A), commits, and every teammate gets them with git pull.
export const HOSTED_PROJECT: HostedProject = HostedProjectSchema.parse({
  apiBaseUrl: 'https://singalore-m-dmyvrad.vercel.app/',
  easProjectId: '47820e9d-9f00-416a-a003-2e90c8ff5d0f',
});

// Uses the hosted API as the default, so nobody needs a .env file. A value already set in the environment wins.
export function withHostedDefaults(raw: Record<string, string | undefined>, hosted: HostedProject): Record<string, string | undefined>
{
  return {
    EXPO_PUBLIC_API_BASE_URL: hosted.apiBaseUrl ?? undefined,
    ...raw,
  };
}

// The Expo Updates server address for this project, or null until the project is linked to Expo.
export function updatesUrl(hosted: HostedProject): string | null
{
  return hosted.easProjectId === null ? null : `https://u.expo.dev/${hosted.easProjectId}`;
}
