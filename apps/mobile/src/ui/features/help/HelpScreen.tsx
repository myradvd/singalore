import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../../theme/tokens';
import { ScreenScaffold } from '../shell/ScreenScaffold';

export const HELP_TOPICS: { question: string; answer: string }[] = [
  { question: 'How do podcasts start?', answer: 'When you walk within range of a heritage site, Singalore asks if you want to listen. Turn on Autoplay in Tour Preferences to start podcasts without asking.' },
  { question: 'How do I plan a route?', answer: 'Open a site on the map and tap Route to add it. Open the route strip to reorder stops, use Auto-Order, then continue to see distance and time before you start.' },
  { question: 'Can I use Singalore offline?', answer: 'Download a heritage park from Explore or Manage Downloads. Podcasts, photos and transcripts then work without a connection. The base map still needs a connection.' },
  { question: 'Why did a podcast not trigger in my pocket?', answer: 'Phones limit background location. Allow location all the time, keep notifications on and exclude Singalore from battery optimisation. Arrivals in the background can take a few minutes.' },
  { question: 'What data leaves my phone?', answer: 'Only route requests include your position, and they are not stored. There are no accounts. Saved routes, history and preferences stay on this phone.' },
];

export function HelpScreen()
{
  const router = useRouter();
  return (
    <ScreenScaffold testID="help-screen" title="Help Centre" onBack={() => router.back()}>
      {HELP_TOPICS.map((topic) => (
        <View key={topic.question} style={styles.topic}>
          <Text style={[typography.heading, { color: colors.text }]} accessibilityRole="header">{topic.question}</Text>
          <Text style={[typography.body, { color: colors.textMuted }]}>{topic.answer}</Text>
        </View>
      ))}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  topic: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, gap: spacing.sm },
});
