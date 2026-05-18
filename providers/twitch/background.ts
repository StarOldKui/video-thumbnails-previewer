import type { ProviderBackgroundActions } from "~providers/background-types"

async function getTwitchPreviewUrls(
  videoId: string,
  signal?: AbortSignal
): Promise<string[]> {
  const gqlResponse = await fetch("https://gql.twitch.tv/gql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Client-ID": "kimne78kx3ncx6brgo4mv6wki5h1ko"
    },
    body: JSON.stringify([
      {
        operationName: "VideoPlayer_VODSeekbarPreviewVideo",
        variables: {
          includePrivate: false,
          videoID: videoId
        },
        extensions: {
          persistedQuery: {
            version: 1,
            sha256Hash:
              "07e99e4d56c5a7c67117a154777b0baf85a5ffefa393b213f4bc712ccaf85dd6"
          }
        }
      }
    ]),
    signal
  })

  if (!gqlResponse.ok) {
    throw new Error("Failed to fetch Twitch preview metadata")
  }

  const gqlData = await gqlResponse.json()
  const seekPreviewsUrl = gqlData[0]?.data?.video?.seekPreviewsURL
  if (!seekPreviewsUrl) {
    throw new Error("Twitch seek preview URL not found")
  }

  const previewResponse = await fetch(seekPreviewsUrl, { signal })
  if (!previewResponse.ok) {
    throw new Error("Failed to fetch Twitch preview manifest")
  }

  const previewData = await previewResponse.json()
  const highQuality = previewData.find((item: any) => item.quality === "high")
  if (!highQuality?.images?.length) {
    throw new Error("Twitch high quality previews not found")
  }

  const baseUrl = seekPreviewsUrl.substring(0, seekPreviewsUrl.lastIndexOf("/"))
  return highQuality.images.map((filename: string) => `${baseUrl}/${filename}`)
}

export const twitchBackgroundActions: ProviderBackgroundActions = {
  providerId: "twitch",
  matches: ["*://*.twitch.tv/*"],
  actions: {
    async "preview-urls"(payload, context) {
      const videoId = (payload as { videoId?: string } | undefined)?.videoId
      if (!videoId) throw new Error("Missing videoId")
      return getTwitchPreviewUrls(videoId, context.signal)
    }
  }
}
