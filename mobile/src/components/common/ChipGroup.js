import { Pressable, StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '../../theme';
import { AppText } from './AppText';

/**
 * Tap-only single choice ("How many?", "When?", queue filters).
 *  - `solid`: the selected chip is filled dark green (counts, filter tabs).
 *  - `soft`: the selected chip is mint with a green outline ("Now" / "Earlier today").
 *
 * @param {{ options: Array<{ value: string, label: string }>, value: string|null, onChange: (value: string) => void, variant?: 'solid'|'soft', testIDPrefix?: string }} props
 */
export function ChipGroup({ options, value, onChange, variant = 'solid', testIDPrefix = 'chip' }) {
  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            onPress={() => onChange(option.value)}
            style={[
              styles.chip,
              variant === 'soft' && styles.chipSoft,
              selected && (variant === 'solid' ? styles.selectedSolid : styles.selectedSoft),
            ]}
            testID={`${testIDPrefix}-${option.value}`}
          >
            <AppText
              variant="bodyStrong"
              color={selected && variant === 'solid' ? 'textOnPrimary' : 'text'}
              numberOfLines={1}
            >
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md },
  chip: {
    flex: 1,
    minHeight: 56,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  chipSoft: { minHeight: 52 },
  selectedSolid: { backgroundColor: colors.primary, borderColor: colors.primary },
  selectedSoft: { backgroundColor: colors.surfaceTint, borderColor: colors.borderStrong },
});
