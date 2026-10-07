import { StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '../../theme';
import { AppText } from '../common/AppText';

/** One big number with a label (duration, distance, incidents ...). */
export function StatTile({ label, value, testID }) {
  return (
    <View style={styles.tile} testID={testID}>
      <AppText variant="title">{value}</AppText>
      <AppText variant="caption" color="textMuted">
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.xxs,
  },
});
