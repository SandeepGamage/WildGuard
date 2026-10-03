import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { AppButton } from '../../src/components/common/AppButton';
import { AppHeader } from '../../src/components/common/AppHeader';
import { LanguageOption } from '../../src/components/common/LanguageOption';
import { ScreenContainer } from '../../src/components/common/ScreenContainer';
import { LANGUAGE_OPTIONS } from '../../src/constants/domain';
import { ROUTES } from '../../src/constants/routes';
import { setLanguage } from '../../src/i18n';
import { markOnboarded } from '../../src/services/onboarding';
import { spacing } from '../../src/theme';

/** Flow 1, step 1: the villager chooses a language (English / Sinhala / Tamil). */
export default function LanguageScreen() {
  const { t, i18n } = useTranslation();

  const proceed = async () => {
    await markOnboarded();
    router.replace(ROUTES.signIn);
  };

  return (
    <ScreenContainer
      footer={<AppButton title={t('common.continue')} onPress={proceed} testID="language-continue" />}
    >
      <AppHeader title={t('language.title')} subtitle={t('language.subtitle')} showLanguage={false} />
      <View style={styles.list}>
        {LANGUAGE_OPTIONS.map((option) => (
          <LanguageOption
            key={option.code}
            option={option}
            selected={option.code === i18n.language}
            onPress={() => setLanguage(option.code)}
          />
        ))}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
});
