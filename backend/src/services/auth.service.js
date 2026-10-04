const { conflict, forbidden, notFound, unauthorized, badRequest } = require('../errors/AppError');
const { phoneToLoginEmail } = require('../utils/phone');

/** Token verification and villager registration on top of Supabase Auth. */
class AuthService {
  /**
   * @param {object} deps
   * @param {{ verifyAccessToken: Function, createUser: Function, deleteUser: Function }} deps.authGateway
   * @param {object} deps.profileRepository
   * @param {object} deps.villageRepository
   * @param {string} deps.phoneLoginEmailDomain
   */
  constructor({ authGateway, profileRepository, villageRepository, phoneLoginEmailDomain }) {
    this.authGateway = authGateway;
    this.profileRepository = profileRepository;
    this.villageRepository = villageRepository;
    this.phoneLoginEmailDomain = phoneLoginEmailDomain;
  }

  /**
   * Validate the bearer token and load the caller's profile and role from the
   * database. The role is never taken from the request.
   * @returns {Promise<{ id: string, email: string|null, profile: object }>}
   */
  async authenticate(token) {
    const identity = await this.authGateway.verifyAccessToken(token);
    if (!identity) throw unauthorized('Your session has expired. Please sign in again.');

    const profile = await this.profileRepository.findById(identity.id);
    if (!profile) throw forbidden('PROFILE_NOT_FOUND', 'No account profile exists for this user.');
    if (!profile.isActive) throw forbidden('ACCOUNT_DISABLED', 'This account is disabled.');

    return { id: identity.id, email: identity.email, profile };
  }

  /**
   * Direct login using phone or email and password.
   * @param {{ account: string, password: string }} credentials
   */
  async login({ account, password }) {
    if (!this.authGateway.verifyCredentials) {
      throw unauthorized('Direct credential login not supported with current auth gateway');
    }
    const session = await this.authGateway.verifyCredentials(account, password);
    const profile = await this.profileRepository.findById(session.id);
    if (!profile) throw forbidden('PROFILE_NOT_FOUND', 'No account profile exists for this user.');
    if (!profile.isActive) throw forbidden('ACCOUNT_DISABLED', 'This account is disabled.');

    return {
      user: { id: session.id, email: session.email, role: session.role },
      profile,
      accessToken: session.token,
    };
  }

  /**
   * Public sign-up is always a VILLAGER. Staff accounts are assigned by the organisation.
   * @param {{ fullName: string, phone: string, villageId: string, password: string, language: string }} input
   */
  async registerVillager(input) {
    const village = await this.villageRepository.findById(input.villageId);
    if (!village) throw badRequest('VILLAGE_NOT_FOUND', 'The selected village was not found.');

    if (await this.profileRepository.findByPhone(input.phone)) {
      throw conflict('PHONE_ALREADY_REGISTERED', 'This mobile number is already registered.');
    }

    const email = phoneToLoginEmail(input.phone, this.phoneLoginEmailDomain);
    const user = await this.#createAuthUser({
      email,
      password: input.password,
      fullName: input.fullName,
      phone: input.phone,
      role: 'VILLAGER',
    });

    try {
      return await this.profileRepository.create({
        id: user.id,
        fullName: input.fullName,
        phone: input.phone,
        language: input.language,
        registeredVillageId: village.id,
      });
    } catch (error) {
      await this.authGateway.deleteUser(user.id);
      throw error;
    }
  }

  async #createAuthUser(details) {
    try {
      return await this.authGateway.createUser(details);
    } catch (error) {
      if (error.code === 'email_exists' || error.status === 422) {
        throw conflict('PHONE_ALREADY_REGISTERED', 'This mobile number is already registered.');
      }
      throw error;
    }
  }

  /** Current user's profile, for /auth/me. */
  async me(user) {
    if (!user.profile) throw notFound('PROFILE_NOT_FOUND', 'Profile not found.');
    return user.profile;
  }
}

module.exports = { AuthService };
