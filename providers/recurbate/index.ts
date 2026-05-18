import { recurbateFeatures } from "~providers/recurbate/features"
import type { PreviewData, VideoProvider } from "~providers/types"
import {
  createGenericSeekToTime,
  processSpriteGridImages,
  waitForVideoDuration
} from "~runtime/processing"

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForTimeline(): Promise<HTMLElement> {
  let clickedPlay = false

  for (let i = 0; i < 300; i++) {
    const timeline = document.getElementById("timeline")
    if (timeline) return timeline

    if (!clickedPlay) {
      const playButton = document.getElementById("play_button") as HTMLElement | null
      if (playButton) {
        playButton.click()
        clickedPlay = true
      }
    }

    await sleep(100)
  }

  throw new Error("Recurbate timeline not found")
}

function getStripeUrl(timeline: HTMLElement): string | null {
  const dataUrl = timeline.getAttribute("data-background-image")
  if (dataUrl) return dataUrl

  const match = timeline.style.backgroundImage.match(
    /url\(["']?(.*?-stripe\.(?:jpg|jpeg|png|webp).*?)["']?\)/i
  )
  return match?.[1] || null
}

export const recurbateProvider: VideoProvider = {
  id: "recurbate",
  label: "Recurbate",
  matches: ["*://*.recu.me/*"],
  defaults: {
    displayMode: "embedded",
    autoOpen: true
  },
  mount: {
    button: ".plyr__time--current",
    embedded: ".video-content-wrapper ~ .video-info"
  },
  features: recurbateFeatures,
  getPageKey(url) {
    const match = url.pathname.match(/\/video\/(\d+)/)
    return match?.[1] || null
  },
  async loadPreview(context): Promise<PreviewData | null> {
    const timeline = await waitForTimeline()
    const stripeUrl = getStripeUrl(timeline)
    if (!stripeUrl) throw new Error("Recurbate stripe image not found")

    const dataUrls = await context.fetchImages([stripeUrl])
    const duration = await waitForVideoDuration(document.querySelector("video"))

    return processSpriteGridImages(
      dataUrls,
      1,
      128,
      0,
      duration,
      createGenericSeekToTime("video", context.afterThumbnailSeek)
    )
  }
}
