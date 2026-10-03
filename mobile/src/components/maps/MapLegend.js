import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MARKER_STATES } from '../../constants/domain';
import { spacing } from '../../theme';
import { AppText } from '../common/AppText';
import { Card } from '../common/Card';
import { MARKER_STYLE } from './markerStyle';

const ORDER = [MARKER_STATES.UNVERIFIED, MARKER_STATES.ACTION_NEEDED, MARKER_STATES.VERIFIED];

/** Unverified / Action / Verified key for the live map. */
export function MapLegend() {
  const { t } = useTranslation();
  return (
    <Card style={styles.card} testID="map-legend">
      {ORDER.map((state) => {
        const { color, Icon, glyphColor, labelKey } = MARKER_STYLE[state];
        return (
          <View key={state} style={styles.item}>
            <View style={[styles.dot, { backgroundColor: color }]}>
              <Icon size={10} color={glyphColor} />
            </View>
            <AppText variant="caption" color="textMuted">
              {t(labelKey)}
            </AppText>
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: spacing.lg },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
