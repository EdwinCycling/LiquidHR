import { z } from 'zod'

// PostgreSQL accepteert iedere canonieke hexadecimale UUID. Sommige
// deterministische fixture-ID's hebben geen RFC-label, waardoor
// z.string().uuid() te streng is aan API-grenzen die database-ID's ontvangen.
export const databaseUuid = z.string().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  'INVALID_UUID',
)
