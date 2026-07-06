const PII_PATTERNS: RegExp[] = [
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, // email
  /\b[A-Z]{5}[0-9]{4}[A-Z]\b/g, // PAN (India)
  /\b\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]\b/gi, // GST (India)
  /\b\d(?:[ -]?\d){8,18}\b/g, // account / card / phone-like digit runs
];

export function redactText(input: string): string {
  let result = input;
  for (const pattern of PII_PATTERNS) {
    result = result.replace(pattern, "[REDACTED]");
  }
  return result;
}
