const { z } = require('zod');

const uuid = z.uuid();
const latitude = z.number().min(-90).max(90);
const longitude = z.number().min(-180).max(180);

const idParams = z.object({ id: uuid });

const pagination = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

/** Build a z.enum from a frozen constants object. */
const enumOf = (constants) => z.enum(Object.values(constants));

module.exports = { uuid, latitude, longitude, idParams, pagination, enumOf };
