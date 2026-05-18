import type { PreviewData, PreviewThumbnail } from "~providers/types"

export interface ProcessorConfig {
  targetWidth: number
  targetHeight: number
}

export interface YouTubeStoryboardData {
  images: Record<string, string>
  results: Array<{ filename: string; success: boolean }>
  storyboardInfo: {
    width: number
    height: number
    totalThumbnails: number
    columns: number
    rows: number
  }
  timeIntervalMs?: number
  videoDuration?: number
  seekToTime?: (timestamp: number) => void | Promise<void>
}

export interface SpriteGridData {
  columns: number
  frameHeight: number
  frameWidth: number
  rows: number
  sampleRate: number
  urls: string[]
  videoDuration?: number
  seekToTime?: (timestamp: number) => void | Promise<void>
}

export const DEFAULT_PROCESSOR_CONFIG: ProcessorConfig = {
  targetWidth: 160,
  targetHeight: 90
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`
}

export function createGenericSeekToTime(
  selector = "video",
  afterSeek?: () => void | Promise<void>
): (timestamp: number) => void {
  return (timestamp: number) => {
    const video = document.querySelector(selector) as HTMLVideoElement | null
    if (!video || !Number.isFinite(timestamp)) return
    video.currentTime = timestamp
    afterSeek?.()
  }
}

export function recoverGeneratedTimestamps(
  data: PreviewData,
  videoDuration: number | undefined
): PreviewData {
  if (!Number.isFinite(videoDuration) || !videoDuration) return data
  if (!data.metadata.totalThumbnails) return data

  return {
    ...data,
    thumbnails: data.thumbnails.map((thumbnail) =>
      typeof thumbnail.timestamp === "number"
        ? thumbnail
        : {
            ...thumbnail,
            timestamp:
              (thumbnail.index / data.metadata.totalThumbnails) * videoDuration
          }
    ),
    metadata: {
      ...data.metadata,
      videoDuration
    }
  }
}

export async function waitForVideoDuration(
  video: HTMLVideoElement | null,
  timeout = 5000
): Promise<number | undefined> {
  if (!video) return undefined
  if (Number.isFinite(video.duration) && video.duration > 0) {
    return video.duration
  }

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      video.removeEventListener("loadedmetadata", onLoaded)
      resolve(undefined)
    }, timeout)

    const onLoaded = () => {
      clearTimeout(timer)
      video.removeEventListener("loadedmetadata", onLoaded)
      resolve(video.duration > 0 ? video.duration : undefined)
    }

    video.addEventListener("loadedmetadata", onLoaded)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function canvasToObjectUrl(canvas: HTMLCanvasElement): Promise<string> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob ? URL.createObjectURL(blob) : canvas.toDataURL("image/png"))
    }, "image/png")
  })
}

async function drawThumbnail(
  img: HTMLImageElement,
  sourceX: number,
  sourceY: number,
  sourceWidth: number,
  sourceHeight: number,
  config: ProcessorConfig
): Promise<string> {
  const canvas = document.createElement("canvas")
  canvas.width = config.targetWidth
  canvas.height = config.targetHeight

  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas context is not available")

  ctx.drawImage(
    img,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    config.targetWidth,
    config.targetHeight
  )

  return canvasToObjectUrl(canvas)
}

function cleanupObjectUrls(urls: string[]): () => void {
  return () => {
    urls.forEach((url) => {
      if (url.startsWith("blob:")) URL.revokeObjectURL(url)
    })
  }
}

export async function processSpriteGridImages(
  dataUrls: string[],
  rows: number,
  columns: number,
  sampleRate: number,
  videoDuration?: number,
  seekToTime?: (timestamp: number) => void | Promise<void>,
  config = DEFAULT_PROCESSOR_CONFIG
): Promise<PreviewData> {
  const thumbnails: PreviewThumbnail[] = []
  const objectUrls: string[] = []

  let totalFrames = 0
  for (const dataUrl of dataUrls) {
    if (!dataUrl) continue
    for (let gridIndex = 0; gridIndex < rows * columns; gridIndex++) {
      if (sampleRate === 0 || gridIndex % (sampleRate + 1) === 0) {
        totalFrames++
      }
    }
  }

  for (const dataUrl of dataUrls) {
    const img = await loadImage(dataUrl)
    const frameWidth = img.width / columns
    const frameHeight = img.height / rows
    let gridIndex = 0

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        if (sampleRate === 0 || gridIndex % (sampleRate + 1) === 0) {
          const index = thumbnails.length
          const thumbnailUrl = await drawThumbnail(
            img,
            col * frameWidth,
            row * frameHeight,
            frameWidth,
            frameHeight,
            config
          )
          objectUrls.push(thumbnailUrl)
          thumbnails.push({
            dataUrl: thumbnailUrl,
            index,
            timestamp:
              videoDuration && totalFrames > 0
                ? (index / totalFrames) * videoDuration
                : undefined
          })
        }
        gridIndex++
      }
    }
  }

  return {
    thumbnails,
    metadata: {
      totalThumbnails: thumbnails.length,
      videoDuration
    },
    cleanup: cleanupObjectUrls(objectUrls),
    seekToTime
  }
}

export function createSpriteGridPreview(data: SpriteGridData): PreviewData {
  const thumbnails: PreviewThumbnail[] = []
  const framesPerSprite = data.rows * data.columns
  const imageWidth = data.frameWidth * data.columns
  const imageHeight = data.frameHeight * data.rows
  let totalFrames = 0

  for (const url of data.urls) {
    if (!url) continue
    for (let gridIndex = 0; gridIndex < framesPerSprite; gridIndex++) {
      if (data.sampleRate === 0 || gridIndex % (data.sampleRate + 1) === 0) {
        totalFrames++
      }
    }
  }

  for (const url of data.urls) {
    if (!url) continue

    for (let gridIndex = 0; gridIndex < framesPerSprite; gridIndex++) {
      if (data.sampleRate !== 0 && gridIndex % (data.sampleRate + 1) !== 0) {
        continue
      }

      const index = thumbnails.length
      const col = gridIndex % data.columns
      const row = Math.floor(gridIndex / data.columns)

      thumbnails.push({
        dataUrl: url,
        index,
        sprite: {
          imageHeight,
          imageWidth,
          sourceHeight: data.frameHeight,
          sourceWidth: data.frameWidth,
          sourceX: col * data.frameWidth,
          sourceY: row * data.frameHeight
        },
        timestamp:
          data.videoDuration && totalFrames > 0
            ? (index / totalFrames) * data.videoDuration
            : undefined
      })
    }
  }

  return {
    thumbnails,
    metadata: {
      totalThumbnails: thumbnails.length,
      videoDuration: data.videoDuration
    },
    seekToTime: data.seekToTime
  }
}

export async function processYouTubeStoryboards(
  data: YouTubeStoryboardData,
  config = DEFAULT_PROCESSOR_CONFIG
): Promise<PreviewData> {
  const thumbnails: PreviewThumbnail[] = []
  const objectUrls: string[] = []
  const { columns, rows, totalThumbnails, width, height } = data.storyboardInfo

  for (const result of data.results) {
    if (!result.success) continue

    const imageUrl = data.images[result.filename]
    if (!imageUrl) continue

    const img = await loadImage(imageUrl)

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        if (thumbnails.length >= totalThumbnails) break
        const index = thumbnails.length
        const thumbnailUrl = await drawThumbnail(
          img,
          col * width,
          row * height,
          width,
          height,
          config
        )
        objectUrls.push(thumbnailUrl)
        thumbnails.push({
          dataUrl: thumbnailUrl,
          index,
          timestamp: data.timeIntervalMs
            ? index * (data.timeIntervalMs / 1000)
            : undefined
        })
      }
    }
  }

  return {
    thumbnails,
    metadata: {
      totalThumbnails: thumbnails.length,
      videoDuration: data.videoDuration
    },
    cleanup: cleanupObjectUrls(objectUrls),
    seekToTime: data.seekToTime
  }
}
