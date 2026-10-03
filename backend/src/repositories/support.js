/**
 * Unwrap a supabase-js response. Database errors are logged by the error
 * middleware and surface to clients only as a generic internal error.
 * @template T
 * @param {{ data: T, error: { message: string, code?: string } | null }} result
 * @returns {T}
 */
function unwrap(result) {
  if (result.error) {
    const error = new Error(`Database error: ${result.error.message}`);
    error.code = result.error.code;
    throw error;
  }
  return result.data;
}

module.exports = { unwrap };
