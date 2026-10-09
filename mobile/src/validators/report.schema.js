import { z } from 'zod';
import { asksElephantCount } from '../constants/incidentTypes';
import { ELEPHANT_COUNT_BANDS, INCIDENT_TYPES, OCCURRED_WHEN } from '../constants/domain';

const coordinate = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

/**
 * A report needs a category and either a chosen village or a GPS fix.
 * Elephant reports also need the "how many" answer.
 */
export const reportDraftSchema = z
  .object({
    incidentType: z.enum(Object.values(INCIDENT_TYPES)),
    elephantCountBand: z.enum(Object.values(ELEPHANT_COUNT_BANDS)).optional(),
    occurredWhen: z.enum(Object.values(OCCURRED_WHEN)),
    villageId: z.string().min(1).optional(),
    coordinates: coordinate.optional(),
  })
  .superRefine((draft, ctx) => {
    if (!draft.villageId && !draft.coordinates) {
      ctx.addIssue({ code: 'custom', path: ['villageId'], message: 'validation.locationRequired' });
    }
    if (asksElephantCount(draft.incidentType) && !draft.elephantCountBand) {
      ctx.addIssue({ code: 'custom', path: ['elephantCountBand'], message: 'validation.countRequired' });
    }
  });
