import { z } from 'zod';

export const AppConfigSchema = z.object({
  appVariant: z.enum(['development', 'preview', 'production']),
  apiBaseUrl: z.string().min(1),
  mapStyleUrl: z.string().min(1),
  debugToolsEnabled: z.boolean(),
  satelliteTileUrl: z.string().min(1).nullish().transform((value) => value ?? null),
  sentryDsn: z.string().min(1).nullish().transform((value) => value ?? null),
});
export type AppConfig = z.output<typeof AppConfigSchema>;

export function parseAppConfig(extra: unknown): AppConfig
{
  return AppConfigSchema.parse(extra);
}
