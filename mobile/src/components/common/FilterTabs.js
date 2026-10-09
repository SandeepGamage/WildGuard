import { Pressable, StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '../../theme';
import { AppText } from './AppText';

/**
 * Pill filter row at the top of the queue and history lists
 * ("Pending 5 / Urgent 2 / Verified 27").
 * @param {{ tabs: Array<{ value: string, label: string }>, value: string, onChange: (value: string) => void }} props
 */
export function FilterTabs({ tabs, value, onChange }) {
  return (
    <View style={styles.row} accessibilityRole="tablist">
      {tabs.map((tab) => {
        const selected = tab.value === value;
        return (
          <Pressable
            key={tab.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(tab.value)}
            style={[styles.tab, selected && styles.selected]}
            testID={`filter-${tab.value}`}
          >
            <AppText variant="bodyStrong" color={selected ? 'textOnPrimary' : 'text'} numberOfLines={1}>
              {tab.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  tab: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  selected: { backgroundColor: colors.primary, borderColor: colors.primary },
});
