import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radii, shadows, spacing, typography } from '../theme/tokens';
import { PrimaryButton, SecondaryButton } from './Buttons';

export interface ModalAction
{
  label: string;
  onPress: () => void;
  kind: 'primary' | 'secondary' | 'danger';
  testID?: string;
}

export function AppModal({ visible, title, message, actions, onRequestClose, testID }: { visible: boolean; title: string; message: string; actions: ModalAction[]; onRequestClose: () => void; testID?: string })
{
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onRequestClose} statusBarTranslucent>
      <View style={styles.scrim}>
        <View testID={testID} style={styles.dialog} accessibilityViewIsModal>
          <ScrollView contentContainerStyle={styles.content} bounces={false}>
            <Text style={[typography.title, styles.title]} accessibilityRole="header">{title}</Text>
            <Text style={[typography.body, styles.message]}>{message}</Text>
            <View style={styles.actions}>
              {actions.map((action) => (action.kind === 'primary'
                ? <PrimaryButton key={action.label} label={action.label} onPress={action.onPress} {...(action.testID === undefined ? {} : { testID: action.testID })} />
                : <SecondaryButton key={action.label} label={action.label} onPress={action.onPress} tone={action.kind === 'danger' ? 'danger' : 'default'} {...(action.testID === undefined ? {} : { testID: action.testID })} />))}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'center', padding: spacing.xl },
  dialog: { maxHeight: '100%', backgroundColor: colors.surface, borderRadius: radii.xl, padding: spacing.xl, paddingTop: spacing.xxl, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, ...shadows.floating },
  content: { gap: spacing.md },
  title: { color: colors.text, textAlign: 'center' },
  message: { color: colors.textMuted, textAlign: 'center' },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
});
