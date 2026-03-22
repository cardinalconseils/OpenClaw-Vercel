/**
 * Phone number normalization to E.164 format.
 *
 * E.164: +[country code][subscriber number] — no spaces, dashes, or parentheses.
 * Used by the call history API route to normalize user input before Supabase lookup.
 */

/**
 * Normalize a phone number string to E.164 format.
 *
 * Rules:
 *  - 10-digit number → assume US (+1 prefix)
 *  - 11-digit number starting with 1 → assume US (+prefix)
 *  - Any other digit count → prepend + (handles international)
 *  - Empty string → "+" (caller is responsible for downstream validation)
 */
export function normalizeToE164(input: string): string {
  const digits = input.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits[0] === '1') return `+${digits}`
  return `+${digits}`
}
