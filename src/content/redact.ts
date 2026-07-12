const PII_PATTERNS: RegExp[] = [
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, // email
  /\b[A-Z]{5}[0-9]{4}[A-Z]\b/g, // PAN (India)
  /\b\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]\b/gi, // GST (India)
  // account / card / phone / date-like digit runs. Minimum 6 digits total
  // (not 9) — real account numbers, ticket/case IDs, and OTP codes are
  // often shorter than a full card number, and privacy-by-structure means
  // erring toward over-redacting a short ordinary number over leaking a
  // real one. The separator class allows any run of common formatting
  // punctuation (spaces, commas, periods, hyphens, slashes, parens) between
  // digits — not just a single character — so "$45,231.00" and
  // "(555) 123-4567" are each caught as one run instead of only their
  // least-formatted fragment.
  /\b\d(?:[ ,.\-/()]*\d){5,18}\b/g,
];

export function redactText(input: string): string {
  let result = input;
  for (const pattern of PII_PATTERNS) {
    result = result.replace(pattern, "[REDACTED]");
  }
  return result;
}
