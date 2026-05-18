import { describe, expect, it } from "vitest"

import { matchesPattern } from "~providers/match-pattern"

describe("matchesPattern", () => {
  it("matches wildcard protocol and optional subdomains", () => {
    expect(matchesPattern("https://recu.me/video/123", "*://*.recu.me/*")).toBe(
      true
    )
    expect(
      matchesPattern("https://www.recu.me/video/123", "*://*.recu.me/*")
    ).toBe(true)
    expect(
      matchesPattern("http://sub.recu.me/video/123", "*://*.recu.me/*")
    ).toBe(true)
  })

  it("does not match unrelated hosts or paths", () => {
    expect(matchesPattern("https://evil-recu.me/video/123", "*://*.recu.me/*")).toBe(
      false
    )
    expect(
      matchesPattern(
        "https://www.youtube.com/results?search_query=x",
        "*://*.youtube.com/watch*"
      )
    ).toBe(false)
  })
})
