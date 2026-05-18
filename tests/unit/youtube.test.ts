import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { youTubeProvider } from "~providers/youtube"

const videoId = "new-video"
const storyboardSpec = `https://i.ytimg.com/sb/${videoId}/storyboard3_L$L/$N.jpg?sqp=test|160#90#10#5#2#10000#M$M#rs$token`

function setupGlobals(playerResponse: unknown, locationVideoId = videoId) {
  vi.stubGlobal("window", { ytInitialPlayerResponse: playerResponse })
  vi.stubGlobal("document", { scripts: [] })
  vi.stubGlobal("location", {
    href: `https://www.youtube.com/watch?v=${locationVideoId}`
  })
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      json: async () => ({
        playabilityStatus: { status: "UNPLAYABLE" },
        videoDetails: { videoId }
      }),
      ok: true
    }))
  )
}

function createContext(pageKey = videoId) {
  return {
    afterThumbnailSeek: vi.fn(),
    pageKey
  } as any
}

describe("YouTube provider SPA recovery", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("throws without reloading when fetched player responses still have no storyboard", async () => {
    setupGlobals({
      videoDetails: { videoId }
    })

    await expect(youTubeProvider.loadPreview(createContext())).rejects.toThrow(
      "YouTube storyboard data not found"
    )
    expect(location).not.toHaveProperty("reload")
  })

  it("does not throw after an aborted YouTube preview request", async () => {
    setupGlobals({
      videoDetails: { videoId }
    })
    const controller = new AbortController()
    controller.abort()

    await expect(
      youTubeProvider.loadPreview({
        ...createContext(),
        signal: controller.signal
      })
    ).resolves.toBeNull()
  })

  it("recovers stale SPA data from the current watch page without reloading", async () => {
    setupGlobals({
      videoDetails: { videoId: "old-video" }
    })
    vi.mocked(fetch).mockImplementation(async (url) => {
      if (String(url).startsWith("/watch")) {
        return {
          ok: true,
          text: async () =>
            `ytInitialPlayerResponse = ${JSON.stringify({
              videoDetails: { lengthSeconds: "90", videoId },
              storyboards: {
                playerStoryboardSpecRenderer: {
                  highResolutionRecommendedLevel: 1,
                  spec: storyboardSpec
                }
              }
            })};`
        } as Response
      }

      return {
        json: async () => ({
          playabilityStatus: { status: "UNPLAYABLE" },
          videoDetails: { videoId }
        }),
        ok: true
      } as Response
    })

    const data = await youTubeProvider.loadPreview(createContext())

    expect(data?.metadata.totalThumbnails).toBe(10)
    expect(fetch).toHaveBeenCalledWith(
      `/watch?v=${encodeURIComponent(videoId)}`,
      expect.any(Object)
    )
  })

  it("uses the runtime page key instead of stale location href", async () => {
    setupGlobals(
      {
        videoDetails: { videoId: "old-video" }
      },
      "old-video"
    )
    vi.mocked(fetch).mockImplementation(async (url) => {
      if (String(url).startsWith("/watch")) {
        return {
          ok: true,
          text: async () =>
            `ytInitialPlayerResponse = ${JSON.stringify({
              videoDetails: { lengthSeconds: "90", videoId },
              storyboards: {
                playerStoryboardSpecRenderer: {
                  highResolutionRecommendedLevel: 1,
                  spec: storyboardSpec
                }
              }
            })};`
        } as Response
      }

      return {
        json: async () => ({
          playabilityStatus: { status: "UNPLAYABLE" },
          videoDetails: { videoId }
        }),
        ok: true
      } as Response
    })

    const data = await youTubeProvider.loadPreview(createContext(videoId))

    expect(data?.metadata.totalThumbnails).toBe(10)
    expect(fetch).toHaveBeenCalledWith(
      `/watch?v=${encodeURIComponent(videoId)}`,
      expect.any(Object)
    )
  })

  it("creates sprite thumbnails directly from storyboard metadata", async () => {
    setupGlobals({
      videoDetails: { lengthSeconds: "90", videoId },
      storyboards: {
        playerStoryboardSpecRenderer: {
          highResolutionRecommendedLevel: 1,
          spec: storyboardSpec
        }
      }
    })

    const data = await youTubeProvider.loadPreview(createContext())

    expect(fetch).not.toHaveBeenCalled()
    expect(data?.metadata.totalThumbnails).toBe(10)
    expect(data?.metadata.videoDuration).toBe(90)
    expect(data?.thumbnails[0]).toMatchObject({
      dataUrl:
        "https://i.ytimg.com/sb/new-video/storyboard3_L1/M0.jpg?sqp=test&sigh=rs%24token",
      index: 0,
      sprite: {
        imageHeight: 180,
        imageWidth: 800,
        sourceHeight: 90,
        sourceWidth: 160,
        sourceX: 0,
        sourceY: 0
      },
      timestamp: 0
    })
    expect(data?.thumbnails[9]).toMatchObject({
      index: 9,
      timestamp: 90
    })
  })
})
