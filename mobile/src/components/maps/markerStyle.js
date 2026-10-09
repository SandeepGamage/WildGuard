import { Check, Clock, TriangleAlert } from 'lucide-react-native';
import { MARKER_STATES } from '../../constants/domain';
import { colors } from '../../theme';

/**
 * Colour + glyph + label key per marker state. Every state has its own glyph
 * and text label, so the map never relies on colour alone.
 */
export const MARKER_STYLE = Object.freeze({
  [MARKER_STATES.UNVERIFIED]: {
    color: colors.markerUnverified,
    glyphColor: colors.textOnPrimary,
    Icon: Clock,
    labelKey: 'map.legend.unverified',
  },
  [MARKER_STATES.ACTION_NEEDED]: {
    color: colors.markerAction,
    glyphColor: colors.primary,
    Icon: TriangleAlert,
    labelKey: 'map.legend.action',
  },
  [MARKER_STATES.VERIFIED]: {
    color: colors.markerVerified,
    glyphColor: colors.textOnPrimary,
    Icon: Check,
    labelKey: 'map.legend.verified',
  },
});
