import { StyleSheet, View } from 'react-native';
import { colors, radius } from '../../theme';
import { AppText } from '../common/AppText';
import { MARKER_STYLE } from './markerStyle';

/** Round pin: state colour + glyph, with a count badge when duplicates are grouped. */
export function IncidentMarker({ markerState, count = 1, selected = false, size = 36 }) {
  const { color, glyphColor, Icon } = MARKER_STYLE[markerState];
  return (
    <View style={styles.wrapper}>
      <View
        style={[
          styles.pin,
          { width: size, height: size, backgroundColor: color },
          selected && styles.selected,
        ]}
      >
        <Icon size={size * 0.5} color={glyphColor} />
      </View>
      {count > 1 ? (
        <View style={styles.count}>
          <AppText variant="pill" color="textOnPrimary" style={styles.countText}>
            {count}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { padding: 6 },
  pin: {
    borderRadius: radius.pill,
    borderWidth: 3,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: { borderColor: colors.primary },
  count: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 20,
    height: 20,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  countText: { letterSpacing: 0, fontSize: 11 },
});
