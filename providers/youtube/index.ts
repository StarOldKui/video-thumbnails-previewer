import type {
  PreviewData,
  PreviewThumbnail,
  VideoProvider
} from "~providers/types"
import { createGenericSeekToTime } from "~runtime/processing"

declare global {
  interface Window {
    ytInitialPlayerResponse?: any
  }
}

function getPlayerResponseFromScripts(): any {
  if (window.ytInitialPlayerResponse) return window.ytInitialPlayerResponse

  for (const script of Array.from(document.scripts)) {
    const text = script.textContent || ""
    if (!text.includes("ytInitialPlayerResponse")) continue

    const match = text.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});/s)
    if (!match?.[1]) continue

    try {
      return JSON.parse(match[1])
    } catch {}
  }

  return null
}

function hasStoryboardForVideo(playerResponse: any, videoId: string): boolean {
  const spec = playerResponse?.storyboards?.playerStoryboardSpecRenderer?.spec
  return typeof spec === "string" && spec.includes(`/sb/${videoId}/`)
}

async function fetchPlayerResponse(
  videoId: string,
  signal?: AbortSignal
): Promise<any> {
  const response = await fetch(
    "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
    {
      method: "POST",
      headers: {
        accept: "*/*",
        "content-type": "application/json",
        "x-youtube-client-name": "1",
        "x-youtube-client-version": "2.20250324.01.00"
      },
      body: JSON.stringify({
        videoId,
        context: {
          client: {
            clientName: "WEB",
            clientVersion: "2.20250324.01.00",
            hl: "en",
            gl: "US",
            userAgent: navigator.userAgent
          }
        }
      }),
      signal
    }
  )

  if (!response.ok) throw new Error("YouTube player response failed")
  return response.json()
}

async function fetchWatchPlayerResponse(
  videoId: string,
  signal?: AbortSignal
): Promise<any> {
  const response = await fetch(`/watch?v=${encodeURIComponent(videoId)}`, {
    signal
  })
  if (!response.ok) throw new Error("YouTube watch response failed")

  const html = await response.text()
  const match = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});/s)
  if (!match?.[1]) return null

  try {
    return JSON.parse(match[1])
  } catch {
    return null
  }
}

function createYouTubeSpritePreview({
  columns,
  height,
  imageUrls,
  rows,
  seekToTime,
  timeIntervalMs,
  totalThumbnails,
  videoDuration,
  width
}: {
  columns: number
  height: number
  imageUrls: string[]
  rows: number
  seekToTime: (timestamp: number) => void | Promise<void>
  timeIntervalMs?: number
  totalThumbnails: number
  videoDuration?: number
  width: number
}): PreviewData {
  const thumbnails: PreviewThumbnail[] = []
  const imageWidth = width * columns
  const imageHeight = height * rows
  const framesPerImage = columns * rows

  for (const imageUrl of imageUrls) {
    for (let frameIndex = 0; frameIndex < framesPerImage; frameIndex++) {
      if (thumbnails.length >= totalThumbnails) break

      const index = thumbnails.length
      const col = frameIndex % columns
      const row = Math.floor(frameIndex / columns)

      thumbnails.push({
        dataUrl: imageUrl,
        index,
        sprite: {
          imageHeight,
          imageWidth,
          sourceHeight: height,
          sourceWidth: width,
          sourceX: col * width,
          sourceY: row * height
        },
        timestamp: timeIntervalMs ? index * (timeIntervalMs / 1000) : undefined
      })
    }
  }

  return {
    thumbnails,
    metadata: {
      totalThumbnails: thumbnails.length,
      videoDuration
    },
    seekToTime
  }
}

export const youTubeProvider: VideoProvider = {
  id: "youtube",
  label: "YouTube",
  matches: ["*://*.youtube.com/*"],
  autoOpenScope: "tab",
  mount: {
    button: ".ytp-left-controls",
    embedded: "#below"
  },
  getPageKey(url) {
    if (!url.hostname.endsWith("youtube.com")) return null
    if (url.pathname !== "/watch") return null
    return url.searchParams.get("v")
  },
  async loadPreview(context): Promise<PreviewData | null> {
    const videoId = context.pageKey
    if (!videoId) return null

    let playerResponse = getPlayerResponseFromScripts()
    if (!hasStoryboardForVideo(playerResponse, videoId)) {
      try {
        playerResponse = await fetchPlayerResponse(videoId, context.signal)
      } catch {
        playerResponse = null
      }
    }

    if (!hasStoryboardForVideo(playerResponse, videoId)) {
      try {
        playerResponse = await fetchWatchPlayerResponse(videoId, context.signal)
      } catch {
        playerResponse = null
      }
    }

    if (!hasStoryboardForVideo(playerResponse, videoId)) {
      if (context.signal?.aborted) return null
      throw new Error("YouTube storyboard data not found")
    }

    const renderer = playerResponse.storyboards.playerStoryboardSpecRenderer
    const parts = renderer.spec.split("|")
    const urlTemplate = parts[0]
    const details = parts[parts.length - 1].split("#")
    const sighToken = details.find((part: string) => part.startsWith("rs"))

    if (!urlTemplate || !sighToken) {
      throw new Error("YouTube storyboard spec is invalid")
    }

    const width = Number.parseInt(details[0], 10)
    const height = Number.parseInt(details[1], 10)
    const totalThumbnails = Number.parseInt(details[2], 10)
    const columns = Number.parseInt(details[3], 10)
    const rows = Number.parseInt(details[4], 10)
    const timeIntervalMs = Number.parseInt(details[5], 10)
    const level = renderer.highResolutionRecommendedLevel
    const perBoard = columns * rows
    const boardCount = Math.ceil(totalThumbnails / perBoard)
    const imageUrls: string[] = []

    for (let i = 0; i < boardCount; i++) {
      imageUrls.push(
        urlTemplate.replace("$L", String(level)).replace("$N", `M${i}`) +
          `&sigh=${encodeURIComponent(sighToken)}`
      )
    }

    return createYouTubeSpritePreview({
      columns,
      height,
      imageUrls,
      rows,
      timeIntervalMs,
      totalThumbnails,
      videoDuration: playerResponse.videoDetails?.lengthSeconds
        ? Number.parseInt(playerResponse.videoDetails.lengthSeconds, 10)
        : undefined,
      width,
      seekToTime: createGenericSeekToTime("video", context.afterThumbnailSeek)
    })
  }
}
