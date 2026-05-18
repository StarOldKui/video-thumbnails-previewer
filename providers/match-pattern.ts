export function matchesPattern(href: string, pattern: string): boolean {
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\\\./g, "(?:[^/]+\\.)?")
    .replace(/\*/g, ".*")
  return new RegExp(`^${escaped}$`).test(href)
}
