import { describe, expect, it } from "vitest"

import { missAvProvider } from "~providers/missav"
import { pimpBunnyProvider } from "~providers/pimpbunny"
import { pornHubProvider } from "~providers/pornhub"
import { recurbateProvider } from "~providers/recurbate"
import { twitchProvider } from "~providers/twitch"
import { youTubeProvider } from "~providers/youtube"

describe("provider page keys", () => {
  it("extracts YouTube watch page keys only from watch pages", () => {
    expect(
      youTubeProvider.getPageKey(new URL("https://www.youtube.com/watch?v=abc"))
    ).toBe("abc")
    expect(
      youTubeProvider.getPageKey(
        new URL("https://www.youtube.com/results?search_query=x&v=abc")
      )
    ).toBeNull()
  })

  it("extracts page keys for supported video URLs", () => {
    expect(twitchProvider.getPageKey(new URL("https://www.twitch.tv/videos/123"))).toBe(
      "123"
    )
    expect(
      recurbateProvider.getPageKey(
        new URL("https://recu.me/juicyandthepussyblvd/video/123/play")
      )
    ).toBe("123")
    expect(missAvProvider.getPageKey(new URL("https://missav.ws/en/abc-123"))).toBe(
      "abc-123"
    )
    expect(
      pornHubProvider.getPageKey(
        new URL("https://www.pornhub.com/view_video.php?viewkey=abc")
      )
    ).toBe("abc")
    expect(
      pimpBunnyProvider.getPageKey(new URL("https://pimpbunny.com/videos/demo/"))
    ).toBe("demo")
  })

  it("returns null for host-level feature pages", () => {
    expect(recurbateProvider.getPageKey(new URL("https://recu.me/performer/demo"))).toBeNull()
    expect(
      pornHubProvider.getPageKey(new URL("https://www.pornhub.com/model/demo/videos"))
    ).toBeNull()
  })

  it("limits tab-scoped auto open to providers that opt in", () => {
    expect(youTubeProvider.autoOpenScope).toBe("tab")
    expect(twitchProvider.autoOpenScope).toBeUndefined()
    expect(recurbateProvider.autoOpenScope).toBeUndefined()
  })

  it("mounts the PimpBunny embedded panel above the video title row", () => {
    expect(pimpBunnyProvider.mount?.embedded).toBe(
      ".row:has(> .col-10.col-md-7 [class*='pages-view-video-video-title'])"
    )
    expect(pimpBunnyProvider.mount?.embeddedPosition).toBe("beforebegin")
  })
})
