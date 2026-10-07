const { z } = require('zod');

const id = z.coerce.number().int().positive();
const idParams = z.object({ id });
const page = z.coerce.number().int().min(1).default(1);
const limit = (max = 100, fallback = 20) => z.coerce.number().int().min(1).max(max).default(fallback);
const boolQuery = z
  .enum(['true', 'false', '1', '0'])
  .transform((value) => value === 'true' || value === '1')
  .optional();

module.exports = { z, id, idParams, page, limit, boolQuery };
