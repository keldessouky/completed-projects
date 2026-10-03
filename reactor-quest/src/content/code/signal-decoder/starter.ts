// Signal ids arrive either as numbers or as strings.
//   number → "#" + the number padded to 4 digits:  42 → "#0042"
//   string → upper-cased:                       "kx-7" → "KX-7"
export function formatId(id: string | number): string {
  return id.toUpperCase();
}

// A channel is one name or a list of names.
//   "alpha"              → "alpha"
//   ["alpha", "beta"]    → "alpha, beta"
export function channelLabel(channel) {
  // TODO
}
