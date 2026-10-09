import { Pressable, StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '../../theme';

const TONES = {
  default: { background: colors.surface, border: colors.border },
  tint: { background: colors.surfaceTint, border: 'transparent' },
  warning: { background: colors.warningTint, border: colors.warningBorder },
  notice: { background: colors.noticeTint, border: colors.noticeBorder },
  danger: { background: colors.dangerTint, border: colors.dangerBorder },
  selected: { background: colors.surfaceTint, border: colors.borderStrong },
};

/** Rounded white surface used for every list row and panel. */
export function Card({ tone = 'default', onPress, style, children, accessibilityLabel, testID }) {
  const palette = TONES[tone];
  const containerStyle = [
    styles.card,
    { backgroundColor: palette.background, borderColor: palette.border },
    style,
  ];

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        testID={testID}
        style={({ pressed }) => [...containerStyle, pressed && styles.pressed]}
      >
        {children}
      </Pressable>
    );
  }
  return (
    <View style={containerStyle} testID={testID}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    borderWidth: 1,
    padding: spacing.lg,
  },
  pressed: { opacity: 0.9 },
});
