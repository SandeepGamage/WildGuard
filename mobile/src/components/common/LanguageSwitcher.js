import { Globe } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LANGUAGE_OPTIONS } from '../../constants/domain';
import { setLanguage } from '../../i18n';
import { colors, radius, spacing } from '../../theme';
import { AppText } from './AppText';
import { LanguageOption } from './LanguageOption';

/** Bottom sheet listing English, Sinhala and Tamil. */
export function LanguageSheet({ visible, onClose }) {
  const { t, i18n } = useTranslation();

  const choose = async (code) => {
    await setLanguage(code);
    onClose();
  };

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <AppText variant="heading" style={styles.sheetTitle}>
            {t('language.title')}
          </AppText>
          {LANGUAGE_OPTIONS.map((option) => (
            <LanguageOption
              key={option.code}
              option={option}
              selected={option.code === i18n.language}
              onPress={() => choose(option.code)}
            />
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** "EN" pill in the header; opens the language sheet. */
export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const current = LANGUAGE_OPTIONS.find((option) => option.code === i18n.language) ?? LANGUAGE_OPTIONS[0];

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('language.change')}
        onPress={() => setOpen(true)}
        style={styles.pill}
        testID="language-switcher"
      >
        <Globe size={16} color={colors.primary} />
        <AppText variant="captionStrong">{current.badge}</AppText>
      </Pressable>
      <LanguageSheet visible={open} onClose={() => setOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    minHeight: 40,
    minWidth: 61,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceTint,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  backdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.hero,
    borderTopRightRadius: radius.hero,
    padding: spacing.xxl,
    gap: spacing.md,
  },
  sheetTitle: { marginBottom: spacing.sm },
});
