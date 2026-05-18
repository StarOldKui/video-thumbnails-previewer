import { runMainWorld } from "~background/run-main-world"
import type { ProviderBackgroundActions } from "~providers/background-types"

export interface MissAvThumbnailConfig {
  col: number
  height: number
  row: number
  urls: string[]
  width: number
}

async function getMissAvThumbnailUrls(tabId: number): Promise<string[]> {
  const result = await runMainWorld<{
    success: boolean
    urls?: string[]
    error?: string
  }>(tabId, async () => {
    for (let i = 0; i < 100; i++) {
      const urls = (window as any).player?.config?.thumbnail?.urls
      if (Array.isArray(urls) && urls.length > 0) {
        return { success: true, urls }
      }
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    return { success: false, error: "MissAV thumbnails not found" }
  })

  if (!result?.success) throw new Error(result?.error || "MissAV script failed")
  return result.urls || []
}

async function getMissAvThumbnailConfig(
  tabId: number
): Promise<MissAvThumbnailConfig> {
  const result = await runMainWorld<{
    config?: MissAvThumbnailConfig
    error?: string
    success: boolean
  }>(tabId, async () => {
    for (let i = 0; i < 100; i++) {
      const thumbnail = (window as any).player?.config?.thumbnail
      if (Array.isArray(thumbnail?.urls) && thumbnail.urls.length > 0) {
        return {
          success: true,
          config: {
            col: thumbnail.col,
            height: thumbnail.height,
            row: thumbnail.row,
            urls: thumbnail.urls,
            width: thumbnail.width
          }
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    return { success: false, error: "MissAV thumbnails not found" }
  })

  if (!result?.success || !result.config) {
    throw new Error(result?.error || "MissAV script failed")
  }
  return result.config
}

export const missAvBackgroundActions: ProviderBackgroundActions = {
  providerId: "missav",
  matches: ["*://*.missav.ws/*", "*://*.missav.com/*"],
  actions: {
    async "thumbnail-config"(_payload, context) {
      if (!context.senderTabId) throw new Error("Missing sender tab")
      return getMissAvThumbnailConfig(context.senderTabId)
    },
    async "thumbnail-urls"(_payload, context) {
      if (!context.senderTabId) throw new Error("Missing sender tab")
      return getMissAvThumbnailUrls(context.senderTabId)
    }
  }
}
