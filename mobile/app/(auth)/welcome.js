import { Camera } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton } from '../../src/components/common/AppButton';
import { AppText } from '../../src/components/common/AppText';
import { ScreenContainer } from '../../src/components/common/ScreenContainer';
import { config } from '../../src/constants/config';
import { ROUTES } from '../../src/constants/routes';
import { colors, radius, spacing } from '../../src/theme';

/** Welcome / splash screen (Figma "WildGuard LK - Protect people. Protect wildlife."). */
export default function WelcomeScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <ScreenContainer
      padTop={false}
      edgeToEdge
      scroll
      footer={
        <>
          <AppButton
            title={t('welcome.getStarted')}
            onPress={() => router.push(ROUTES.language)}
            testID="get-started"
          />
          <AppText variant="caption" color="textMuted" style={styles.footer}>
            {t('welcome.footer')}
          </AppText>
          {config.demoMode ? (
            <AppText
              variant="captionStrong"
              style={styles.demo}
              onPress={() => router.push(ROUTES.demo.smsSimulator)}
              accessibilityRole="link"
              testID="demo-sms-link"
            >
              {t('welcome.smsSimulator')}
            </AppText>
          ) : null}
        </>
      }
    >
      <LinearGradient
        colors={[colors.heroTop, colors.heroBottom]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingTop: insets.top + spacing.xl }]}
      >
        <View style={styles.heroTop}>
          <View style={styles.logo} accessibilityLabel={t('common.appName')}>
            <AppText variant="heading" color="primary">
              WG
            </AppText>
          </View>
          <Camera size={20} color={colors.textOnPrimary} />
        </View>
        <AppText variant="heading" color="textOnPrimary" style={styles.appName}>
          {t('common.appName')}
        </AppText>
        <AppText variant="display" color="textOnPrimary" style={styles.tagline}>
          {t('welcome.tagline')}
        </AppText>
        <AppText variant="body" color="textOnPrimary" style={styles.intro}>
          {t('welcome.intro')}
        </AppText>
        <View style={styles.photoNote}>
          <AppText variant="pill" color="textOnPrimary">
            {t('welcome.photoLabel')}
          </AppText>
          <AppText variant="caption" color="textOnPrimary">
            {t('welcome.photoCaption')}
          </AppText>
        </View>
      </LinearGradient>

      <View style={styles.body}>
        <AppText variant="heading" style={styles.bodyTitle}>
          {t('welcome.builtFor')}
        </AppText>
        <AppText variant="body" color="textMuted">
          {t('welcome.builtForBody')}
        </AppText>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hero: {
    minHeight: 520,
    borderBottomLeftRadius: radius.hero,
    borderBottomRightRadius: radius.hero,
    paddingHorizontal: spacing.screenX,
    paddingBottom: spacing.xl,
  },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  logo: {
    width: 58,
    height: 58,
    borderRadius: radius.md,
    backgroundColor: colors.highlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: { marginTop: spacing.xxl, fontSize: 28 },
  tagline: { marginTop: spacing.lg },
  intro: { marginTop: spacing.xl, opacity: 0.92 },
  photoNote: { marginTop: 'auto', paddingTop: spacing.xxl, gap: spacing.xxs },
  body: { paddingHorizontal: spacing.screenX, paddingTop: spacing.xxl },
  bodyTitle: { marginBottom: spacing.sm },
  footer: { textAlign: 'center', marginTop: spacing.md },
  demo: {
    textAlign: 'center',
    marginTop: spacing.md,
    textDecorationLine: 'underline',
    paddingVertical: spacing.sm,
  },
});
