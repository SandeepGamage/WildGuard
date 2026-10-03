import { Phone, ShieldCheck, TriangleAlert } from 'lucide-react-native';
import { Linking, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { EMERGENCY_NUMBER } from '../../constants/domain';
import { colors, radius, spacing } from '../../theme';
import { AppButton } from '../common/AppButton';
import { AppText } from '../common/AppText';
import { Card } from '../common/Card';

/**
 * Safety messaging.
 *  - `distance` (amber): "Keep your distance. Do not approach the animal."
 *  - `urgent` (red, prominent): "Someone is injured? Call 1990 first." with a call button.
 */
export function SafetyBanner({ variant = 'distance' }) {
  const { t } = useTranslation();

  if (variant === 'urgent') {
    return (
      <Card tone="danger" style={styles.urgent} testID="urgent-banner">
        <View style={styles.urgentHeader}>
          <TriangleAlert size={26} color={colors.dangerText} />
          <AppText variant="heading" color="dangerText" style={styles.urgentTitle} accessibilityRole="alert">
            {t('urgent.title', { number: EMERGENCY_NUMBER })}
          </AppText>
        </View>
        <AppText variant="body" color="textBody" style={styles.urgentBody}>
          {t('urgent.body')}
        </AppText>
        <AppButton
          variant="danger"
          title={t('urgent.call', { number: EMERGENCY_NUMBER })}
          icon={<Phone size={18} color={colors.textOnPrimary} />}
          onPress={() => Linking.openURL(`tel:${EMERGENCY_NUMBER}`)}
          testID="call-1990"
        />
      </Card>
    );
  }

  return (
    <Card tone="warning" style={styles.distance} testID="distance-banner">
      <ShieldCheck size={22} color={colors.warningText} />
      <View style={styles.text}>
        <AppText variant="bodyStrong" color="warningText">
          {t('details.keepDistance')}
        </AppText>
        <AppText variant="caption" color="warningText">
          {t('details.ifInjured', { number: EMERGENCY_NUMBER })}
        </AppText>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  distance: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  text: { flex: 1, gap: spacing.xxs },
  urgent: { gap: spacing.md, borderRadius: radius.card, borderWidth: 2, borderColor: colors.danger },
  urgentHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  urgentTitle: { flex: 1 },
  urgentBody: { marginBottom: spacing.xs },
});
