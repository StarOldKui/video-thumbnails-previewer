import { missAvProvider } from "~providers/missav"
import { pimpBunnyProvider } from "~providers/pimpbunny"
import { pornHubProvider } from "~providers/pornhub"
import { recurbateProvider } from "~providers/recurbate"
import { matchesPattern } from "~providers/match-pattern"
import type { VideoProvider } from "~providers/types"
import { twitchProvider } from "~providers/twitch"
import { youTubeProvider } from "~providers/youtube"

export const providers: VideoProvider[] = [
  youTubeProvider,
  twitchProvider,
  recurbateProvider,
  missAvProvider,
  pornHubProvider,
  pimpBunnyProvider
]

export function findProvider(url: URL): VideoProvider | null {
  return (
    findHostProviders(url).find((provider) => provider.getPageKey(url) !== null) ||
    null
  )
}

export function findHostProvider(url: URL): VideoProvider | null {
  return findHostProviders(url)[0] || null
}

export function findHostProviders(url: URL): VideoProvider[] {
  return providers.filter((provider) =>
    provider.matches.some((pattern) => matchesPattern(url.href, pattern))
  )
}
