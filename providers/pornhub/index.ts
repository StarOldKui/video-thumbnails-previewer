import { pornHubFeatures } from "~providers/pornhub/features"
import type { PreviewData, VideoProvider } from "~providers/types"
import {
  processSpriteGridImages,
  waitForVideoDuration
} from "~runtime/processing"

interface PornHubSpriteData {
  urls: string[]
  samplingFrequency?: number
  videoDuration?: number
}

function createPornHubSeekToTime(
  getAdOffset: () => number,
  afterSeek: () => void | Promise<void>
) {
  return (timestamp: number) => {
    if (!Number.isFinite(timestamp)) return

    const video = document.querySelector(
      "video.mgp_videoElement"
    ) as HTMLVideoElement | null
    if (!video) return

    video.currentTime = timestamp + getAdOffset()
    if (video.paused) {
      video.play().catch(() => {})
    }
    afterSeek()
  }
}

export const pornHubProvider: VideoProvider = {
  id: "pornhub",
  label: "PornHub",
  matches: ["*://*.pornhub.com/*"],
  defaults: {
    displayMode: "embedded",
    autoOpen: true
  },
  mount: {
    button: ".mgp_autoplay",
    embedded: ".title-container"
  },
  features: pornHubFeatures,
  getPageKey(url) {
    if (!url.pathname.includes("view_video.php")) return null
    return url.searchParams.get("viewkey")
  },
  async loadPreview(context): Promise<PreviewData | null> {
    const spriteData = await context.runProviderAction<PornHubSpriteData>(
      "sprite-data"
    )
    const dataUrls = await context.fetchImages(spriteData.urls)
    const video = document.querySelector(
      "video.mgp_videoElement"
    ) as HTMLVideoElement | null
    const domDuration = await waitForVideoDuration(video)
    const thumbnailDuration = spriteData.videoDuration || domDuration
    const adOffset =
      domDuration && thumbnailDuration
        ? Math.max(0, domDuration - thumbnailDuration)
        : 0

    const processed = await processSpriteGridImages(
      dataUrls,
      5,
      5,
      0,
      thumbnailDuration,
      createPornHubSeekToTime(() => adOffset, context.afterThumbnailSeek)
    )

    const samplingFrequency = spriteData.samplingFrequency
    if (samplingFrequency) {
      const spriteStartTimes = spriteData.urls.map((url, index) => {
        const match = url.match(/vts(?::|%3A)(\d+)/i)
        if (match) return Number.parseInt(match[1], 10)
        return index * 25 * samplingFrequency
      })

      processed.thumbnails.forEach((thumbnail, index) => {
        const spriteIndex = Math.floor(index / 25)
        const gridIndex = index % 25
        const spriteStartTime = spriteStartTimes[spriteIndex] || 0
        thumbnail.timestamp =
          spriteStartTime + gridIndex * samplingFrequency + samplingFrequency
      })
    }

    return processed
  }
}
