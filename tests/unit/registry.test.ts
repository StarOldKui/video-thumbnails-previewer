import { describe, expect, it } from "vitest"

import { findHostProvider, findHostProviders, findProvider } from "~providers/registry"

describe("provider registry", () => {
  it("selects page providers only after host matches", () => {
    expect(
      findProvider(new URL("https://www.youtube.com/watch?v=abc"))?.id
    ).toBe("youtube")
    expect(
      findProvider(new URL("https://www.youtube.com/results?search_query=x&v=abc"))
    ).toBeNull()
  })

  it("keeps host-level feature pages separate from video pages", () => {
    const recurbatePerformer = new URL("https://recu.me/performer/example")
    expect(findProvider(recurbatePerformer)).toBeNull()
    expect(findHostProvider(recurbatePerformer)?.id).toBe("recurbate")

    const pornHubModel = new URL("https://www.pornhub.com/model/example/videos")
    expect(findProvider(pornHubModel)).toBeNull()
    expect(findHostProviders(pornHubModel).map((provider) => provider.id)).toContain(
      "pornhub"
    )
  })

  it("detects supported video page providers", () => {
    expect(findProvider(new URL("https://www.twitch.tv/videos/123"))?.id).toBe(
      "twitch"
    )
    expect(
      findProvider(new URL("https://recu.me/juicyandthepussyblvd/video/123/play"))
        ?.id
    ).toBe("recurbate")
    expect(findProvider(new URL("https://missav.ws/en/abc-123"))?.id).toBe(
      "missav"
    )
    expect(
      findProvider(new URL("https://www.pornhub.com/view_video.php?viewkey=abc"))?.id
    ).toBe("pornhub")
    expect(findProvider(new URL("https://pimpbunny.com/videos/example/"))?.id).toBe(
      "pimpbunny"
    )
  })

  it("does not detect removed provider URLs", () => {
    expect(findProvider(new URL("https://www.sexkbj.com/example_sexkbj/"))).toBeNull()
    expect(findProvider(new URL("https://koreanbj.club/video/example/"))).toBeNull()
  })
})
