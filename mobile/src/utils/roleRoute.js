import { USER_ROLES } from '../constants/domain';
import { ROUTES } from '../constants/routes';

/**
 * Landing route for a signed-in user. Each role gets a completely separate
 * interface; roles without a mobile interface in this release (field ranger)
 * get no route and are signed out by the caller.
 * @returns {string|null}
 */
export function homeRouteForRole(role) {
  if (role === USER_ROLES.VILLAGER) return ROUTES.villager.home;
  if (role === USER_ROLES.COMMUNITY_LIAISON_OFFICER) return ROUTES.liaison.queue;
  return null;
}
