import { afterEach, describe, expect, it, vi } from "vitest"

import { pimpBunnyBackgroundActions } from "~providers/pimpbunny/background"

function createResponse(ok: boolean, status: number): Response {
  return {
    ok,
    status,
    body: {
      cancel: vi.fn()
    },
    headers: {
      get: vi.fn()
    }
  } as unknown as Response
}

describe("PimpBunny background actions", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("probes the real last thumbnail instead of trusting an estimated count", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const match = url.match(/\/182x100\/(\d+)\.jpg$/)
        const index = match ? Number.parseInt(match[1], 10) : 0
        return createResponse(index > 0 && index <= 3, index <= 3 ? 200 : 404)
      })
    )

    const urls = await pimpBunnyBackgroundActions.actions["thumbnail-urls"](
      {
        videoId: "12345",
        totalCount: 10
      },
      {}
    )

    expect(urls).toEqual([
      "https://pimpbunny.com/contents/videos_screenshots/12000/12345/timelines/720_mp4/182x100/1.jpg",
      "https://pimpbunny.com/contents/videos_screenshots/12000/12345/timelines/720_mp4/182x100/2.jpg",
      "https://pimpbunny.com/contents/videos_screenshots/12000/12345/timelines/720_mp4/182x100/3.jpg"
    ])
  })
})
