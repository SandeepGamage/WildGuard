const { randomUUID } = require('node:crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../../models/mongo/schemas');
const { normalizePhone, phoneToLoginEmail } = require('../../utils/phone');
const { AppError } = require('../../errors/AppError');

class MongoAuthGateway {
  /**
   * @param {object} deps
   * @param {string} deps.jwtSecret
   * @param {string} deps.phoneLoginEmailDomain
   */
  constructor({ jwtSecret, phoneLoginEmailDomain }) {
    this.jwtSecret = jwtSecret;
    this.phoneLoginEmailDomain = phoneLoginEmailDomain;
  }

  async verifyAccessToken(token) {
    if (!token) return null;

    try {
      const decoded = jwt.verify(token, this.jwtSecret);
      if (decoded && decoded.id) {
        return { id: decoded.id, email: decoded.email ?? null };
      }
    } catch {
      return null;
    }

    return null;
  }

  async createUser({ email, password, fullName, phone, role }) {
    const existing = await User.findOne({
      $or: [{ email: email.toLowerCase() }, ...(phone ? [{ phone }] : [])],
    }).lean();

    if (existing) {
      const error = new Error('User already exists');
      error.code = 'email_exists';
      error.status = 422;
      throw error;
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    const id = randomUUID();

    await User.create({
      id,
      email: email.toLowerCase(),
      phone: phone ?? null,
      password_hash: passwordHash,
      role: role || 'VILLAGER',
      full_name: fullName,
      is_active: true,
    });

    return { id };
  }

  async deleteUser(id) {
    await User.deleteOne({ id });
  }

  async verifyCredentials(account, password) {
    let user = null;
    const trimmed = (account || '').trim();

    if (trimmed.includes('@')) {
      user = await User.findOne({ email: trimmed.toLowerCase() });
    } else {
      const phone = normalizePhone(trimmed);
      const email = phoneToLoginEmail(phone || trimmed, this.phoneLoginEmailDomain);
      user = await User.findOne({
        $or: [{ phone }, { email: email.toLowerCase() }, { phone: trimmed }],
      });
    }

    if (!user || !user.is_active) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid login credentials.');
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid login credentials.');
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      this.jwtSecret,
      { expiresIn: '30d' },
    );

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      token,
    };
  }
}

module.exports = { MongoAuthGateway };
