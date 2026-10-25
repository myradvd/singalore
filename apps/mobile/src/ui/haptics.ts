import * as Haptics from 'expo-haptics';

export function selectionTick(): void
{
  Haptics.selectionAsync().catch(() => undefined);
}
