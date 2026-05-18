import { runMainWorld } from "~background/run-main-world"
import type { ProviderBackgroundActions } from "~providers/background-types"

async function getPornHubSpriteData(tabId: number): Promise<{
  urls: string[]
  samplingFrequency?: number
  videoDuration?: number
}> {
  const result = await runMainWorld<{
    success: boolean
    urls?: string[]
    samplingFrequency?: number
    videoDuration?: number
    error?: string
  }>(tabId, async () => {
    for (let i = 0; i < 10; i++) {
      const key = Object.keys(window).find((name) => name.startsWith("flashvars_"))
      const flashvars = key ? (window as any)[key] : null
      const thumbs = flashvars?.thumbs

      if (thumbs?.spritePatterns?.length) {
        return {
          success: true,
          urls: thumbs.spritePatterns,
          samplingFrequency: thumbs.samplingFrequency,
          videoDuration: flashvars.video_duration
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    return { success: false, error: "PornHub sprite data not found" }
  })

  if (!result?.success) throw new Error(result?.error || "PornHub script failed")
  return {
    urls: result.urls || [],
    samplingFrequency: result.samplingFrequency,
    videoDuration: result.videoDuration
  }
}

export const pornHubBackgroundActions: ProviderBackgroundActions = {
  providerId: "pornhub",
  matches: ["*://*.pornhub.com/*"],
  actions: {
    async "sprite-data"(_payload, context) {
      if (!context.senderTabId) throw new Error("Missing sender tab")
      return getPornHubSpriteData(context.senderTabId)
    }
  }
}
