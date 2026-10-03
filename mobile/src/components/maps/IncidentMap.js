import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { DEFAULT_MAP_REGION } from '../../constants/domain';
import { colors, radius } from '../../theme';
import { IncidentMarker } from './IncidentMarker';

const SNAPSHOT_DELAY_MS = 600;
const EDGE_PADDING = { top: 80, right: 60, bottom: 160, left: 60 };

/**
 * react-native-maps wrapper. Markers are drawn as <IncidentMarker> (colour +
 * glyph + optional count).
 *
 * @param {{
 *   markers: Array<{ id: string, latitude: number, longitude: number, markerState: string, groupedCount?: number }>,
 *   selectedId?: string|null,
 *   onSelect?: (id: string) => void,
 *   interactive?: boolean,
 *   style?: object,
 * }} props
 */
export function IncidentMap({ markers, selectedId = null, onSelect, interactive = true, style }) {
  const mapRef = useRef(null);
  const [settledKey, setSettledKey] = useState(null);

  // Custom marker views need a moment to be rasterised after they change; tracking is then
  // switched off for performance (Android re-draws tracked markers on every frame).
  const renderKey = `${selectedId}|${markers.map((m) => `${m.id}:${m.markerState}:${m.groupedCount}`).join(',')}`;
  const tracking = settledKey !== renderKey;
  useEffect(() => {
    const timer = setTimeout(() => setSettledKey(renderKey), SNAPSHOT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [renderKey]);

  const fitMarkers = useCallback(() => {
    if (!mapRef.current || markers.length === 0) return;
    mapRef.current.fitToCoordinates(
      markers.map(({ latitude, longitude }) => ({ latitude, longitude })),
      { edgePadding: EDGE_PADDING, animated: false },
    );
  }, [markers]);

  return (
    <View style={[styles.container, style]} testID="incident-map">
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={DEFAULT_MAP_REGION}
        onMapReady={fitMarkers}
        onLayout={fitMarkers}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        showsCompass={false}
      >
        {markers.map((marker) => (
          <Marker
            key={marker.id}
            coordinate={{ latitude: marker.latitude, longitude: marker.longitude }}
            onPress={() => onSelect?.(marker.id)}
            tracksViewChanges={tracking}
            testID={`marker-${marker.id}`}
          >
            <IncidentMarker
              markerState={marker.markerState}
              count={marker.groupedCount}
              selected={marker.id === selectedId}
            />
          </Marker>
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.hero,
    overflow: 'hidden',
    backgroundColor: colors.mapLand,
  },
  map: { flex: 1 },
});
