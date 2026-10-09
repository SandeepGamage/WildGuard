import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { INCIDENT_TYPE_META } from '../../constants/incidentTypes';
import { colors, radius, spacing } from '../../theme';
import { AppText } from '../common/AppText';

/**
 * Large icon tile for choosing what is happening. Big targets and icons keep
 * the first step usable for low-literacy reporters.
 */
export function CategoryCard({ incidentType, onPress }) {
  const { t } = useTranslation();
  const { labelKey, Icon, tint, iconColor } = INCIDENT_TYPE_META[incidentType];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t(labelKey)}
      onPress={() => onPress(incidentType)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      testID={`category-${incidentType}`}
    >
      <View style={[styles.tile, { backgroundColor: tint }]}>
        <Icon size={22} color={iconColor} />
      </View>
      <AppText variant="cardTitle" numberOfLines={3}>
        {t(labelKey)}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minHeight: 132,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    justifyContent: 'space-between',
  },
  pressed: { opacity: 0.85 },
  tile: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
});
