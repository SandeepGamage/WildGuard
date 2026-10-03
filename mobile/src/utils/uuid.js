import * as Crypto from 'expo-crypto';

/** RFC 4122 v4 id, used as the idempotency key for report submissions. */
export const newClientRequestId = () => Crypto.randomUUID();
