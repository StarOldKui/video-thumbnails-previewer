import { throwIfAborted } from "~background/request-registry"
import type { ProviderBackgroundActions } from "~providers/background-types"

const PIMP_BUNNY_PATH_VARIANTS = ["720_mp4", "pb_720_mp4", "mp4"] as const
const PIMP_BUNNY_MAX_THUMBNAILS = 300

function buildPimpBunnyThumbnailUrl(
  videoId: string,
  index: number,
  pathVariant: string
): string {
  const numericId = Number.parseInt(videoId, 10)
  const folder = Math.floor(numericId / 1000) * 1000
  return `https://pimpbunny.com/contents/videos_screenshots/${folder}/${videoId}/timelines/${pathVariant}/182x100/${index}.jpg`
}

function shouldRetry(status: number): boolean {
  return status === 429 || status >= 500
}

async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  throwIfAborted(signal)

  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer)
      signal?.removeEventListener("abort", onAbort)
    }
    const timer = setTimeout(() => {
      cleanup()
      resolve()
    }, ms)
    const onAbort = () => {
      cleanup()
      reject(new Error("Request aborted"))
    }

    signal?.addEventListener("abort", onAbort, { once: true })
  })
}

function attachAbortSignal(
  controller: AbortController,
  signal?: AbortSignal
): () => void {
  if (!signal) return () => {}
  const onAbort = () => controller.abort()
  signal.addEventListener("abort", onAbort, { once: true })
  return () => signal.removeEventListener("abort", onAbort)
}

async function probeFetch(
  url: string,
  options?: RequestInit,
  retries = 3,
  signal?: AbortSignal
): Promise<Response | null> {
  for (let i = 0; i < retries; i++) {
    throwIfAborted(signal)

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10000)
    const detachAbort = attachAbortSignal(controller, signal)

    try {
      const response = await fetch(url, { ...options, signal: controller.signal })
      if (!shouldRetry(response.status)) return response

      await response.body?.cancel().catch(() => {})
      const retryAfter = Number.parseInt(
        response.headers.get("Retry-After") || "",
        10
      )
      await sleep(
        Number.isFinite(retryAfter) ? retryAfter * 1000 : 1000 * (i + 1),
        signal
      )
    } catch {
      if (i < retries - 1) await sleep(1000 * (i + 1), signal)
    } finally {
      clearTimeout(timer)
      detachAbort()
    }
  }

  return null
}

async function probeThumbnail(
  url: string,
  signal?: AbortSignal
): Promise<boolean> {
  const head = await probeFetch(url, { method: "HEAD" }, 3, signal)
  if (head?.ok) return true
  if (head && ![403, 405, 501].includes(head.status)) return false

  const response = await probeFetch(
    url,
    {
      method: "GET",
      headers: {
        Range: "bytes=0-0"
      }
    },
    3,
    signal
  )
  await response?.body?.cancel().catch(() => {})
  return Boolean(response?.ok)
}

async function detectPimpBunnyPathVariant(
  videoId: string,
  signal?: AbortSignal
): Promise<string> {
  for (const variant of PIMP_BUNNY_PATH_VARIANTS) {
    if (
      await probeThumbnail(
        buildPimpBunnyThumbnailUrl(videoId, 1, variant),
        signal
      )
    ) {
      return variant
    }
  }

  throw new Error("PimpBunny thumbnails not available")
}

async function findPimpBunnyLastIndex(
  videoId: string,
  pathVariant: string,
  signal?: AbortSignal
): Promise<number> {
  const probePoints = [300, 250, 200, 150, 100, 50, 25, 10, 1]
  let upperBound = 0

  for (const point of probePoints) {
    if (
      await probeThumbnail(
        buildPimpBunnyThumbnailUrl(videoId, point, pathVariant),
        signal
      )
    ) {
      upperBound = point
      break
    }
  }

  if (upperBound === 0) return 0

  let low = upperBound
  let high = Math.min(upperBound + 50, PIMP_BUNNY_MAX_THUMBNAILS)
  let lastValid = upperBound

  while (low <= high) {
    const mid = Math.floor((low + high) / 2)

    if (
      await probeThumbnail(
        buildPimpBunnyThumbnailUrl(videoId, mid, pathVariant),
        signal
      )
    ) {
      lastValid = mid
      low = mid + 1
    } else {
      high = mid - 1
    }
  }

  return lastValid
}

async function getPimpBunnyThumbnailUrls(
  videoId: string,
  _totalCount?: number,
  signal?: AbortSignal
): Promise<string[]> {
  const variant = await detectPimpBunnyPathVariant(videoId, signal)
  const count = await findPimpBunnyLastIndex(videoId, variant, signal)

  if (count <= 0) {
    throw new Error("PimpBunny thumbnail count not found")
  }

  return Array.from({ length: count }, (_, index) =>
    buildPimpBunnyThumbnailUrl(videoId, index + 1, variant)
  )
}

export const pimpBunnyBackgroundActions: ProviderBackgroundActions = {
  providerId: "pimpbunny",
  matches: ["*://*.pimpbunny.com/videos/*"],
  actions: {
    async "thumbnail-urls"(payload, context) {
      const body = payload as
        | { videoId?: string; totalCount?: number }
        | undefined
      if (!body?.videoId) throw new Error("Missing videoId")
      return getPimpBunnyThumbnailUrls(
        body.videoId,
        body.totalCount,
        context.signal
      )
    }
  }
}
