import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { colors, radius, spacing, TOUCH_TARGET } from '../../theme';
import { AppText } from './AppText';

const VARIANTS = {
  primary: { background: colors.primary, border: colors.primary, text: 'textOnPrimary' },
  secondary: { background: colors.surface, border: colors.border, text: 'text' },
  danger: { background: colors.danger, border: colors.danger, text: 'textOnPrimary' },
  accent: { background: colors.highlight, border: colors.highlight, text: 'text' },
  soft: { background: colors.surfaceTint, border: colors.border, text: 'text' },
};

/**
 * Full-width rounded action button (Figma "Verify", "Send report", "Sign in").
 * @param {{ variant?: keyof typeof VARIANTS, compact?: boolean, loading?: boolean, icon?: import('react').ReactNode }} props
 */
export function AppButton({
  title,
  onPress,
  variant = 'primary',
  compact = false,
  loading = false,
  disabled = false,
  icon = null,
  style,
  testID,
}) {
  const palette = VARIANTS[variant];
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        compact && styles.compact,
        { backgroundColor: palette.background, borderColor: palette.border },
        inactive && styles.inactive,
        pressed && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'secondary' || variant === 'soft' ? colors.primary : colors.textOnPrimary}
        />
      ) : (
        <View style={styles.content}>
          {icon}
          <AppText variant="button" color={palette.text}>
            {title}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 56,
    borderRadius: radius.button,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  compact: { minHeight: TOUCH_TARGET, paddingHorizontal: spacing.lg },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  inactive: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
});
