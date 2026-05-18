import type { PreviewData, VideoProvider } from "~providers/types"
import {
  createGenericSeekToTime,
  processSpriteGridImages,
  waitForVideoDuration
} from "~runtime/processing"

export const twitchProvider: VideoProvider = {
  id: "twitch",
  label: "Twitch",
  matches: ["*://*.twitch.tv/*"],
  defaults: {
    displayMode: "embedded",
    autoOpen: true
  },
  mount: {
    button: ".player-controls__right-control-group",
    embedded: ".channel-info-content"
  },
  getPageKey(url) {
    const match = url.pathname.match(/\/videos\/(\d+)/)
    return match?.[1] || null
  },
  async loadPreview(context): Promise<PreviewData | null> {
    const videoId = context.pageKey
    if (!videoId) return null

    const urls = await context.runProviderAction<string[]>("preview-urls", {
      videoId
    })
    const dataUrls = await context.fetchImages(urls)
    const duration = await waitForVideoDuration(document.querySelector("video"))

    return processSpriteGridImages(
      dataUrls,
      10,
      5,
      0,
      duration,
      createGenericSeekToTime("video", context.afterThumbnailSeek)
    )
  }
}
