import { Camera, MapPin, Phone, RadioTower } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { VERIFICATION_METHODS } from '../../constants/domain';
import { colors, radius, spacing } from '../../theme';
import { AppText } from '../common/AppText';

const METHODS = [
  { value: VERIFICATION_METHODS.CALL_REPORTER, labelKey: 'verify.methods.call', Icon: Phone },
  { value: VERIFICATION_METHODS.SITE_VISIT, labelKey: 'verify.methods.visit', Icon: MapPin },
  { value: VERIFICATION_METHODS.PHOTO_REVIEW, labelKey: 'verify.methods.photo', Icon: Camera },
  { value: VERIFICATION_METHODS.SENSOR_DATA, labelKey: 'verify.methods.sensor', Icon: RadioTower },
];

/** How the officer checked the report: call, visit, photo or sensor data. */
export function MethodSelector({ value, onChange }) {
  const { t } = useTranslation();
  return (
    <View style={styles.panel}>
      <AppText variant="cardTitle" style={styles.title}>
        {t('verify.method')}
      </AppText>
      <View style={styles.row} accessibilityRole="radiogroup">
        {METHODS.map(({ value: method, labelKey, Icon }) => {
          const selected = method === value;
          return (
            <Pressable
              key={method}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={t(labelKey)}
              onPress={() => onChange(method)}
              style={[styles.option, selected && styles.optionSelected]}
              testID={`method-${method}`}
            >
              <Icon size={16} color={selected ? colors.textOnPrimary : colors.primary} />
              <AppText variant="captionStrong" color={selected ? 'textOnPrimary' : 'text'} numberOfLines={1}>
                {t(labelKey)}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surfaceTint,
    borderRadius: radius.card,
    padding: spacing.lg,
  },
  title: { marginBottom: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm },
  option: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  optionSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
});
