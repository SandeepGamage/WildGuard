/** Thin wrapper over Supabase Auth admin/session verification. */
class AuthGateway {
  /** @param {import('@supabase/supabase-js').SupabaseClient} db Service-role client. */
  constructor(db) {
    this.auth = db.auth;
  }

  /**
   * Validate an access token with Supabase Auth.
   * @returns {Promise<{ id: string, email: string|null }|null>} null when the token is invalid.
   */
  async verifyAccessToken(token) {
    const { data, error } = await this.auth.getUser(token);
    if (error || !data.user) return null;
    return { id: data.user.id, email: data.user.email ?? null };
  }

  /** @returns {Promise<{ id: string }>} The new auth user (email pre-confirmed). */
  async createUser({ email, password, fullName }) {
    const { data, error } = await this.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (error) {
      const failure = new Error(error.message);
      failure.code = error.code;
      failure.status = error.status;
      throw failure;
    }
    return { id: data.user.id };
  }

  async deleteUser(id) {
    await this.auth.admin.deleteUser(id);
  }
}

module.exports = { AuthGateway };
