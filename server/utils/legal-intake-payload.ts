// U6-authored create-intake payload shape (R15).
//
// U4's brief explicitly deferred this: "No create-intake schema/validator
// exists yet... U6 will define the actual intake payload shape when it
// builds the public route." This file is that definition -- a JUDGMENT
// CALL, not a confirmed U8/product contract. Flag for eventual
// reconciliation once U8's real intake-creation contract is known (see the
// U6 report). Kept minimal and hand-rolled (an allowlisted-field
// plain-object validator), matching this repo's existing style
// (server/utils/api-response.ts's readStrictBody) rather than adding a
// validation-library dependency.

import { isRecord, readString } from '~/server/utils/type-guards'

export interface LegalIntakePayload {
  matterType: string
  fullName: string
  email: string
  phone: string | null
  description: string
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ALLOWED_FIELDS = new Set(['matterType', 'fullName', 'email', 'phone', 'description'])

// Every field is required except phone (nullable). Length bounds are
// conservative choices for this route, not a confirmed U8 field-length
// contract. Returns undefined for any unknown field, wrong type, empty
// required string, or out-of-bound value -- fails closed rather than
// passing anything not explicitly allowlisted through to
// buildLegalIntakeDigest/callBlawbyRoute.
export function validateLegalIntakePayload(value: unknown): LegalIntakePayload | undefined {
  if (!isRecord(value)) return undefined
  const unknownKeys = Object.keys(value).filter(key => !ALLOWED_FIELDS.has(key))
  if (unknownKeys.length) return undefined

  const matterType = readString(value, 'matterType')?.trim()
  const fullName = readString(value, 'fullName')?.trim()
  const email = readString(value, 'email')?.trim().toLowerCase()
  const description = readString(value, 'description')?.trim()
  const phoneRaw = value.phone

  if (!matterType || matterType.length > 200) return undefined
  if (!fullName || fullName.length > 200) return undefined
  if (!email || email.length > 320 || !EMAIL_PATTERN.test(email)) return undefined
  if (!description || description.length > 5000) return undefined
  if (phoneRaw !== undefined && phoneRaw !== null && typeof phoneRaw !== 'string') return undefined
  // Reject an out-of-bound phone value, same as every other field in this
  // validator — never silently truncate, which would accept a different,
  // wrong value as if it were valid input.
  const trimmedPhone = typeof phoneRaw === 'string' ? phoneRaw.trim() : null
  if (typeof phoneRaw === 'string' && (!trimmedPhone || trimmedPhone.length > 50)) return undefined
  const phone = trimmedPhone

  return { matterType, fullName, email, phone, description }
}
