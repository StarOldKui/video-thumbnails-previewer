import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import { matchesPattern } from "~providers/match-pattern"

const contentPath = fileURLToPath(new URL("../../content.tsx", import.meta.url))

function getContentScriptMatches(): string[] {
  const source = readFileSync(contentPath, "utf8")
  const matchesBlock = source.match(/matches:\s*\[([\s\S]*?)\]/)
  if (!matchesBlock) return []

  return Array.from(matchesBlock[1].matchAll(/"([^"]+)"/g)).map(
    (match) => match[1]
  )
}

describe("content script config", () => {
  it("injects on YouTube host pages so SPA watch navigation is covered", () => {
    const matches = getContentScriptMatches()
    const url = "https://www.youtube.com/"

    expect(matches.some((pattern) => matchesPattern(url, pattern))).toBe(true)
  })

  it("injects on Twitch host pages so SPA VOD navigation is covered", () => {
    const matches = getContentScriptMatches()
    const url = "https://www.twitch.tv/"

    expect(matches.some((pattern) => matchesPattern(url, pattern))).toBe(true)
  })

  it("injects on Recurbate performer video pages", () => {
    const matches = getContentScriptMatches()
    const url = "https://recu.me/juicyandthepussyblvd/video/32606622/play"

    expect(matches.some((pattern) => matchesPattern(url, pattern))).toBe(true)
  })

  it("does not inject on removed provider pages", () => {
    const matches = getContentScriptMatches()

    expect(
      matches.some((pattern) =>
        matchesPattern("https://www.sexkbj.com/example_sexkbj/", pattern)
      )
    ).toBe(false)
    expect(
      matches.some((pattern) =>
        matchesPattern("https://koreanbj.club/video/example/", pattern)
      )
    ).toBe(false)
  })

  it("uses a stable Plasmo shadow host id", () => {
    const source = readFileSync(contentPath, "utf8")

    expect(source).toContain('getShadowHostId: PlasmoGetShadowHostId')
    expect(source).toContain('"vtp-root"')
  })

  it("tracks SPA URL changes through history events and polling", () => {
    const source = readFileSync(contentPath, "utf8")

    expect(source).toContain("history.pushState")
    expect(source).toContain("history.replaceState")
    expect(source).toContain('window.addEventListener("popstate", updateHref)')
    expect(source).toContain("window.setInterval(updateHref, 500)")
  })

  it("auto opens scoped providers once per content app lifecycle", () => {
    const source = readFileSync(contentPath, "utf8")

    expect(source).toContain('provider.autoOpenScope === "tab"')
    expect(source).toContain("autoOpenedProviders.current.has(provider.id)")
    expect(source).toContain("autoOpenedProviders.current.add(provider.id)")
  })

  it("allows an aborted preview load to retry", () => {
    const source = readFileSync(contentPath, "utf8")

    expect(source).toContain('if (loadedToken.current === token) loadedToken.current = ""')
  })

  it("renders popup previews through a document body portal", () => {
    const source = readFileSync(contentPath, "utf8")

    expect(source).toContain("function BodyPortal")
    expect(source).toContain("<BodyPortal>{panel}</BodyPortal>")
  })
})
