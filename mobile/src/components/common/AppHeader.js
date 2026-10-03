import { ChevronLeft } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, radius, spacing } from '../../theme';
import { AppText } from './AppText';
import { LanguageSwitcher } from './LanguageSwitcher';

/**
 * Screen title block: big title, muted subtitle and the language pill on the
 * right. `onBack` adds a back chevron on pushed screens.
 */
export function AppHeader({ title, subtitle, onBack, showLanguage = true }) {
  const { t } = useTranslation();
  return (
    <View style={styles.wrapper}>
      <View style={styles.row}>
        <View style={styles.titleBlock}>
          {onBack ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.back')}
              onPress={onBack}
              style={styles.back}
              testID="header-back"
            >
              <ChevronLeft size={22} color={colors.primary} />
            </Pressable>
          ) : null}
          <AppText variant="title" accessibilityRole="header" style={styles.title}>
            {title}
          </AppText>
        </View>
        {showLanguage ? <LanguageSwitcher /> : null}
      </View>
      {subtitle ? (
        <AppText variant="body" color="textMuted" style={styles.subtitle}>
          {subtitle}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: spacing.xl },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  titleBlock: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { flexShrink: 1 },
  subtitle: { marginTop: spacing.xs },
  back: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
