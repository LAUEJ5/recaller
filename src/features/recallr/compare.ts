export function normalizeForCompare(raw: string) {
  // Case-insensitive, punctuation-flexible:
  // "dont" === "don't" === "don't," etc.
  return raw.toLowerCase().replace(/[^a-z0-9]/g, '')
}

