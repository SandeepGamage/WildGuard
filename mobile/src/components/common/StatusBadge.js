import { StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '../../theme';
import { AppText } from './AppText';

export const BADGE_TONES = {
  urgent: { background: colors.dangerTint, text: 'dangerText' },
  warning: { background: colors.warningPill, text: 'warningText' },
  neutral: { background: colors.neutralTint, text: 'neutralText' },
  success: { background: colors.successTint, text: 'success' },
  earth: { background: colors.earthTint, text: 'earthText' },
  danger: { background: colors.dangerTint, text: 'dangerText' },
};

/**
 * Small rounded status pill ("URGENT", "Being checked", "VERIFIED"...).
 * The label always carries the meaning, so colour is never the only signal.
 */
export function StatusBadge({ label, tone = 'neutral', uppercase = false, style, testID }) {
  const palette = BADGE_TONES[tone];
  return (
    <View style={[styles.badge, { backgroundColor: palette.background }, style]} testID={testID}>
      <AppText variant="pill" color={palette.text} style={uppercase ? undefined : styles.mixedCase}>
        {uppercase ? label.toUpperCase() : label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    minHeight: 32,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  mixedCase: { letterSpacing: 0, fontSize: 12 },
});
