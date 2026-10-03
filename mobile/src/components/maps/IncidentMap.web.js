import { StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '../../theme';
import { IncidentMarker } from './IncidentMarker';

/**
 * Web fallback used only by `expo start --web` previews: react-native-maps has no
 * browser implementation, so markers are laid out on a plain tinted surface
 * (relative positions only). Native builds use IncidentMap.js.
 */
export function IncidentMap({ markers, selectedId = null, onSelect, style }) {
  const latitudes = markers.map((marker) => marker.latitude);
  const longitudes = markers.map((marker) => marker.longitude);
  const span = (values) => Math.max(Math.max(...values) - Math.min(...values), 0.0001);
  const position = (value, values, size) =>
    values.length < 2 ? size / 2 : ((value - Math.min(...values)) / span(values)) * (size - 20) + 10;

  return (
    <View style={[styles.container, style]} testID="incident-map">
      <View style={styles.road} />
      {markers.map((marker) => (
        <View
          key={marker.id}
          onClick={() => onSelect?.(marker.id)}
          style={[
            styles.marker,
            {
              left: `${position(marker.longitude, longitudes, 100)}%`,
              top: `${100 - position(marker.latitude, latitudes, 100)}%`,
            },
          ]}
        >
          <IncidentMarker
            markerState={marker.markerState}
            count={marker.groupedCount}
            selected={marker.id === selectedId}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.hero,
    overflow: 'hidden',
    backgroundColor: colors.mapLand,
    minHeight: 160,
    padding: spacing.xl,
  },
  road: {
    position: 'absolute',
    left: -20,
    right: -20,
    top: '45%',
    height: 6,
    backgroundColor: colors.mapRoad,
    transform: [{ rotate: '5deg' }],
  },
  marker: { position: 'absolute', marginLeft: -24, marginTop: -24 },
});
