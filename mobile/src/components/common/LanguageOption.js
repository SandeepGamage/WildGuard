import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, radius, spacing } from '../../theme';
import { AppText } from './AppText';

/**
 * One language row: badge ("EN"), native name and a check when selected.
 * Used by the onboarding language screen and the header switcher sheet.
 */
export function LanguageOption({ option, selected, onPress }) {
  const { t } = useTranslation();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={option.nativeName}
      onPress={onPress}
      style={[styles.row, selected && styles.rowSelected]}
      testID={`language-option-${option.code}`}
    >
      <View style={[styles.badge, selected && styles.badgeSelected]}>
        <AppText variant="bodyStrong" color={selected ? 'textOnPrimary' : 'text'}>
          {option.badge}
        </AppText>
      </View>
      <View style={styles.text}>
        <AppText variant="cardTitle">{option.nativeName}</AppText>
        {selected ? (
          <AppText variant="caption" color="textMuted">
            {t('language.selected')}
          </AppText>
        ) : null}
      </View>
      {selected ? (
        <View style={styles.check}>
          <Check size={14} color={colors.textOnPrimary} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 80,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.lg,
  },
  rowSelected: { backgroundColor: colors.surfaceTint, borderColor: colors.borderStrong },
  badge: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeSelected: { backgroundColor: colors.primary },
  text: { flex: 1 },
  check: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
