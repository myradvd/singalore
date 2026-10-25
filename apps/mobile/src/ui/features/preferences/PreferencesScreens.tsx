import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { BackHandler, StyleSheet, Text, View } from 'react-native';
import { useAppServices } from '@/composition/AppServicesContext';
import { useCatalogStore } from '@/modules/catalog/catalogStore';
import type { Preferences } from '@/modules/prefs/preferencesSchema';
import { resetPreferences, updatePreferences, usePreferencesStore } from '@/modules/prefs/preferencesStore';
import { AppModal } from '../../primitives/AppModal';
import { PrimaryButton, SecondaryButton } from '../../primitives/Buttons';
import { Chip } from '../../primitives/Chip';
import { ListRow } from '../../primitives/ListRow';
import { Toggle } from '../../primitives/Toggle';
import { colors, spacing, typography } from '../../theme/tokens';
import { showToast } from '../../toastStore';
import { ScreenScaffold, SectionTitle } from '../shell/ScreenScaffold';
import { NOT_AVAILABLE_RECOMMENDATIONS, PREFERENCE_SECTIONS, isDirty, type ChoiceOption, type PreferenceField, type PreferenceSection } from './preferenceSections';

export function PreferencesIndexScreen()
{
  const router = useRouter();
  const services = useAppServices();
  const [confirmReset, setConfirmReset] = useState(false);

  const reset = async () =>
  {
    setConfirmReset(false);
    await resetPreferences(services.preferences);
    showToast('Preferences reset to defaults.');
  };

  return (
    <ScreenScaffold testID="preferences-screen" title="Tour Preferences" onBack={() => router.back()}>
      {PREFERENCE_SECTIONS.map((section) => (
        <ListRow
          key={section.id}
          testID={`preferences-${section.id}`}
          icon={section.icon}
          title={section.title}
          subtitle={section.subtitle}
          onPress={() => router.push(`/preferences/${section.id}`)}
        />
      ))}
      <ListRow testID="preferences-recommendations" icon="star-outline" title="Recommendations" subtitle={NOT_AVAILABLE_RECOMMENDATIONS} disabled />
      <ListRow testID="preferences-downloads" icon="download" title="Downloads" subtitle="Wi-Fi only and stored parks" onPress={() => router.push('/downloads')} />
      <View style={styles.resetRow}>
        <SecondaryButton testID="preferences-reset" label="Reset to defaults" icon="undo" tone="danger" onPress={() => setConfirmReset(true)} />
      </View>
      <Text style={[typography.caption, styles.version]}>{`Singalore version ${Constants.expoConfig?.version ?? 'unknown'}`}</Text>
      <AppModal
        testID="preferences-reset-modal"
        visible={confirmReset}
        title="Reset all preferences?"
        message="Every tour preference returns to its default. Saved routes, sites and downloads are kept."
        onRequestClose={() => setConfirmReset(false)}
        actions={[
          { label: 'Reset', kind: 'danger', testID: 'preferences-reset-confirm', onPress: () => void reset() },
          { label: 'Cancel', kind: 'secondary', testID: 'preferences-reset-cancel', onPress: () => setConfirmReset(false) },
        ]}
      />
    </ScreenScaffold>
  );
}

function withValue<Key extends keyof Preferences>(draft: Preferences, key: Key, value: Preferences[Key]): Preferences
{
  return { ...draft, [key]: value };
}

export function PreferencesSectionScreen({ section }: { section: PreferenceSection })
{
  const router = useRouter();
  const services = useAppServices();
  const saved = usePreferencesStore((state) => state.preferences);
  const podcasts = useCatalogStore((state) => state.snapshot.podcasts);
  const [draft, setDraft] = useState<Preferences>(saved);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const dirty = isDirty(section, saved, draft);

  const catalogOptions = useMemo(() => ({
    voice: [...new Set(podcasts.flatMap((podcast) => (podcast.voice === null ? [] : [podcast.voice])))].sort(),
    accent: [...new Set(podcasts.flatMap((podcast) => (podcast.accent === null ? [] : [podcast.accent])))].sort(),
  }), [podcasts]);

  const requestBack = () =>
  {
    if (dirty)
    {
      setConfirmLeave(true);
      return;
    }
    router.back();
  };

  useEffect(() =>
  {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () =>
    {
      if (!dirty)
      {
        return false;
      }
      setConfirmLeave(true);
      return true;
    });
    return () => subscription.remove();
  }, [dirty]);

  const save = async (leave: boolean) =>
  {
    const changes: Partial<Preferences> = {};
    for (const field of section.fields)
    {
      Object.assign(changes, { [field.key]: draft[field.key] });
    }
    await updatePreferences(services.preferences, changes);
    showToast('Preferences saved.');
    setConfirmLeave(false);
    if (leave)
    {
      router.back();
    }
  };

  const renderChoice = <Key extends keyof Preferences>(key: Key, label: string, options: ChoiceOption<Preferences[Key]>[]) => (
    <View key={key} style={styles.choice}>
      <Text style={[typography.bodyStrong, { color: colors.text }]}>{label}</Text>
      <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {options.map((option) => (
          <Chip
            key={option.label}
            testID={`pref-${key}-${option.label}`}
            label={option.label}
            selected={JSON.stringify(draft[key]) === JSON.stringify(option.value)}
            onPress={() => setDraft(withValue(draft, key, option.value))}
          />
        ))}
      </View>
    </View>
  );

  const renderField = (field: PreferenceField) =>
  {
    switch (field.kind)
    {
      case 'toggle':
        return (
          <Toggle
            key={field.key}
            testID={`pref-${field.key}`}
            label={field.label}
            description={field.description}
            value={draft[field.key]}
            onValueChange={(value) => setDraft(withValue(draft, field.key, value))}
            disabled={field.disabledReason !== undefined}
            {...(field.disabledReason === undefined ? {} : { disabledReason: field.disabledReason })}
          />
        );
      case 'catalogChoice':
      {
        const values = catalogOptions[field.source];
        return renderChoice(field.key, field.label, [{ label: 'Any', value: null }, ...values.map((value) => ({ label: value, value }))]);
      }
      case 'choice':
        switch (field.key)
        {
          case 'walkingPace':
            return renderChoice(field.key, field.label, field.options);
          case 'distanceUnit':
            return renderChoice(field.key, field.label, field.options);
          case 'playbackRate':
            return renderChoice(field.key, field.label, field.options);
          case 'preferredLength':
            return renderChoice(field.key, field.label, field.options);
        }
    }
  };

  return (
    <ScreenScaffold
      testID={`preferences-${section.id}-screen`}
      title={section.title}
      onBack={requestBack}
      footer={(
        <>
          <SecondaryButton testID="pref-discard" label="Discard changes" disabled={!dirty} onPress={() => setDraft(saved)} style={styles.footerButton} />
          <PrimaryButton testID="pref-save" label="Save" disabled={!dirty} onPress={() => void save(false)} style={styles.footerButton} />
        </>
      )}
    >
      <SectionTitle label={section.subtitle} />
      {section.fields.map(renderField)}
      <AppModal
        testID="pref-unsaved-modal"
        visible={confirmLeave}
        title="Save your changes?"
        message="You changed some preferences on this page."
        onRequestClose={() => setConfirmLeave(false)}
        actions={[
          { label: 'Save', kind: 'primary', testID: 'pref-unsaved-save', onPress: () => void save(true) },
          { label: 'Discard', kind: 'danger', testID: 'pref-unsaved-discard', onPress: () =>
          {
            setConfirmLeave(false);
            router.back();
          } },
          { label: 'Cancel', kind: 'secondary', testID: 'pref-unsaved-cancel', onPress: () => setConfirmLeave(false) },
        ]}
      />
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  resetRow: { padding: spacing.xl },
  version: { color: colors.textMuted, textAlign: 'center' },
  choice: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md, gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  footerButton: { flex: 1 },
});
