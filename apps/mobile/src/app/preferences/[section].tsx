import { Redirect, useLocalSearchParams } from 'expo-router';
import { PREFERENCE_SECTIONS, isSectionId } from '@/ui/features/preferences/preferenceSections';
import { PreferencesSectionScreen } from '@/ui/features/preferences/PreferencesScreens';

export default function PreferenceSectionRoute()
{
  const { section } = useLocalSearchParams<{ section: string }>();
  const match = isSectionId(section) ? PREFERENCE_SECTIONS.find((candidate) => candidate.id === section) : undefined;
  if (match === undefined)
  {
    return <Redirect href="/preferences" />;
  }
  return <PreferencesSectionScreen section={match} />;
}
