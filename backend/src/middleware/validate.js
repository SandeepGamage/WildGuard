const { badRequest } = require('../errors/AppError');

/**
 * Validates request parts with Zod schemas and exposes the parsed result as
 * `req.validated`. Unknown body fields are stripped, so client-supplied
 * role/status/reporter ids can never reach a service.
 * @param {{ body?: import('zod').ZodType, params?: import('zod').ZodType, query?: import('zod').ZodType }} schemas
 */
function validate(schemas) {
  return (req, _res, next) => {
    const validated = {};
    for (const part of ['params', 'query', 'body']) {
      if (!schemas[part]) continue;
      const result = schemas[part].safeParse(req[part] ?? {});
      if (!result.success) {
        const issues = result.error.issues.map((issue) => ({
          field: [part, ...issue.path].join('.'),
          message: issue.message,
        }));
        return next(badRequest('VALIDATION_FAILED', 'Some details are missing or invalid.', { issues }));
      }
      validated[part] = result.data;
    }
    req.validated = validated;
    return next();
  };
}

module.exports = { validate };
