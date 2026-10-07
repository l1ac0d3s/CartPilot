const { badRequest } = require('../utils/errors');

/**
 * Validates req[part] against a zod schema. The parsed (coerced) value is exposed on
 * req.valid[part] because Express 5 makes req.query read-only.
 */
function validate(schema, part = 'body') {
  return (req, _res, next) => {
    const result = schema.safeParse(req[part] ?? {});
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.') || part,
        message: issue.message,
      }));
      throw badRequest(details[0] ? `${details[0].field}: ${details[0].message}` : 'Invalid request', {
        code: 'VALIDATION_ERROR',
        details,
      });
    }
    req.valid = { ...(req.valid || {}), [part]: result.data };
    next();
  };
}

module.exports = { validate };
