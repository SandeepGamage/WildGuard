import { Eye, House, List, ShieldCheck, TriangleAlert } from 'lucide-react-native';
import { colors } from '../theme';
import { INCIDENT_TYPES } from './domain';

/**
 * Presentation metadata per incident category: translation key, icon and the
 * tint of the icon tile (mirrors the Figma category tiles).
 */
export const INCIDENT_TYPE_META = Object.freeze({
  [INCIDENT_TYPES.ELEPHANT_NEAR_VILLAGE]: {
    labelKey: 'incidentTypes.ELEPHANT_NEAR_VILLAGE',
    Icon: ShieldCheck,
    tint: colors.surfaceTint,
    iconColor: colors.primary,
  },
  [INCIDENT_TYPES.CROP_DAMAGE]: {
    labelKey: 'incidentTypes.CROP_DAMAGE',
    Icon: TriangleAlert,
    tint: colors.earthTint,
    iconColor: colors.primary,
  },
  [INCIDENT_TYPES.PROPERTY_DAMAGE]: {
    labelKey: 'incidentTypes.PROPERTY_DAMAGE',
    Icon: House,
    tint: colors.earthTint,
    iconColor: colors.primary,
  },
  [INCIDENT_TYPES.PERSON_INJURED]: {
    labelKey: 'incidentTypes.PERSON_INJURED',
    Icon: TriangleAlert,
    tint: colors.dangerTint,
    iconColor: colors.dangerText,
  },
  [INCIDENT_TYPES.SNARE_POACHING]: {
    labelKey: 'incidentTypes.SNARE_POACHING',
    Icon: Eye,
    tint: colors.warningTint,
    iconColor: colors.primary,
  },
  [INCIDENT_TYPES.OTHER_ANIMAL]: {
    labelKey: 'incidentTypes.OTHER_ANIMAL',
    Icon: List,
    tint: colors.surfaceTint,
    iconColor: colors.primary,
  },
});

/** Order of the category tiles on the "What is happening?" screen. */
export const CATEGORY_ORDER = Object.freeze([
  INCIDENT_TYPES.ELEPHANT_NEAR_VILLAGE,
  INCIDENT_TYPES.CROP_DAMAGE,
  INCIDENT_TYPES.PROPERTY_DAMAGE,
  INCIDENT_TYPES.PERSON_INJURED,
  INCIDENT_TYPES.SNARE_POACHING,
  INCIDENT_TYPES.OTHER_ANIMAL,
]);

/** Only elephant reports ask "How many?". */
export const asksElephantCount = (incidentType) => incidentType === INCIDENT_TYPES.ELEPHANT_NEAR_VILLAGE;
