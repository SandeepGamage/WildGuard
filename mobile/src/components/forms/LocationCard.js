import { MapPin } from 'lucide-react-native';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, radius, spacing } from '../../theme';
import { AppText } from '../common/AppText';
import { Card } from '../common/Card';

/**
 * Report location row: pin tile, village name, "Detected from GPS" caption and
 * a "Change" action that opens the village list.
 *
 * @param {{ villageName: string|null, source: 'GPS'|'MANUAL'|null, isLocating?: boolean, message?: string, onChange: () => void }} props
 */
export function LocationCard({ villageName, source, isLocating = false, message, onChange }) {
  const { t } = useTranslation();

  let caption = message;
  if (isLocating) caption = t('details.locating');
  else if (source === 'GPS') caption = t('details.detectedGps');
  else if (source === 'MANUAL' && villageName) caption = t('details.selectedFromList');

  return (
    <Card style={styles.card} testID="location-card">
      <View style={styles.tile}>
        {isLocating ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <MapPin size={22} color={colors.primary} />
        )}
      </View>
      <View style={styles.text}>
        <AppText variant="cardTitle" numberOfLines={1}>
          {villageName ?? t('details.noVillage')}
        </AppText>
        <AppText variant="caption" color="textMuted">
          {caption}
        </AppText>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('details.change')}
        onPress={onChange}
        style={styles.change}
        testID="location-change"
      >
        <AppText variant="bodyStrong">{t('details.change')}</AppText>
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, minHeight: 88 },
  tile: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1 },
  change: { minHeight: 48, minWidth: 48, justifyContent: 'center', alignItems: 'flex-end' },
});
