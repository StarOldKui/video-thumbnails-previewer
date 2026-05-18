import type { PreviewData, VideoProvider } from "~providers/types"
import { waitForVideoDuration } from "~runtime/processing"

function extractNumericVideoId(): string | null {
  for (const input of Array.from(document.querySelectorAll("input"))) {
    const value = (input as HTMLInputElement).value
    if (/^\d{5,7}$/.test(value)) return value
  }

  for (const script of Array.from(document.scripts)) {
    const content = script.textContent || ""
    const match = content.match(/video_id['":\s]+['"]?(\d{5,7})['"]?/)
    if (match) return match[1]
  }

  for (const image of Array.from(
    document.querySelectorAll<HTMLImageElement>('img[src*="videos_screenshots"]')
  )) {
    const match = image.src.match(/\/videos_screenshots\/\d+\/(\d{5,7})\//)
    if (match) return match[1]
  }

  return null
}

function seekPimpBunny(timestamp: number): void {
  const video = document.querySelector("video") as HTMLVideoElement | null
  if (!video || !Number.isFinite(timestamp)) return

  video.currentTime = timestamp
  if (video.paused) {
    video.play().catch(() => {})
  }
}

export const pimpBunnyProvider: VideoProvider = {
  id: "pimpbunny",
  label: "PimpBunny",
  matches: ["*://*.pimpbunny.com/*"],
  defaults: {
    displayMode: "embedded",
    autoOpen: true
  },
  mount: {
    button: ".fp-ui",
    embedded:
      ".row:has(> .col-10.col-md-7 [class*='pages-view-video-video-title'])",
    embeddedPosition: "beforebegin"
  },
  getPageKey(url) {
    const match = url.pathname.match(/\/videos\/([^/]+)\/?$/)
    return match?.[1] || null
  },
  async loadPreview(context): Promise<PreviewData | null> {
    const videoId = extractNumericVideoId()
    if (!videoId) throw new Error("PimpBunny video ID not found")

    const duration = await waitForVideoDuration(
      document.querySelector("video"),
      60000
    )
    const totalCount = duration ? Math.ceil(duration / 10) : undefined
    const imageUrls = await context.runProviderAction<string[]>(
      "thumbnail-urls",
      { videoId, totalCount }
    )
    const totalThumbnails = imageUrls.length

    return {
      thumbnails: imageUrls.map((imageUrl, index) => ({
        dataUrl: imageUrl,
        index,
        timestamp:
          duration && totalThumbnails > 0
            ? (index / totalThumbnails) * duration
            : undefined
      })),
      metadata: {
        totalThumbnails,
        videoDuration: duration
      },
      seekToTime: (timestamp) => {
        seekPimpBunny(timestamp)
        context.afterThumbnailSeek()
      }
    }
  }
}
