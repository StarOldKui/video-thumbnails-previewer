export type DisplayMode = "popup" | "embedded"

export interface ProviderSettings {
  displayMode: DisplayMode
  autoOpen: boolean
}

export interface PreviewState {
  visible: boolean
  mode: DisplayMode
  pageKey: string
  updatedAt: number
}

export interface PreviewThumbnail {
  dataUrl: string
  index: number
  timestamp?: number
  raw?: boolean
  sprite?: {
    imageHeight: number
    imageWidth: number
    sourceHeight: number
    sourceWidth: number
    sourceX: number
    sourceY: number
  }
}

export interface PreviewData {
  thumbnails: PreviewThumbnail[]
  metadata: {
    totalThumbnails: number
    videoDuration?: number
  }
  cleanup?: () => void
  seekToTime?: (timestamp: number) => void | Promise<void>
}

export interface ProviderContext {
  pageKey: string
  settings: ProviderSettings
  signal?: AbortSignal
  afterThumbnailSeek: (videoSelector?: string) => void | Promise<void>
  closePreview: () => Promise<void>
  fetchImages: (urls: string[]) => Promise<string[]>
  findResource: (
    videoUrl: string,
    pattern: string,
    timeoutMs?: number
  ) => Promise<string | null>
  openTabs: (urls: string[]) => Promise<number>
  runProviderAction: <TResponse = unknown>(
    action: string,
    payload?: unknown
  ) => Promise<TResponse>
  scrollToVideo: (selector?: string) => void
}

export interface ProviderFeatureContext {
  fetchImages: (urls: string[]) => Promise<string[]>
  findResource: (
    videoUrl: string,
    pattern: string,
    timeoutMs?: number
  ) => Promise<string | null>
  openTabs: (urls: string[]) => Promise<number>
  runProviderAction: <TResponse = unknown>(
    action: string,
    payload?: unknown
  ) => Promise<TResponse>
}

export interface ProviderFeature {
  id: string
  matches: (url: URL) => boolean
  mount: (context: ProviderFeatureContext) => void | (() => void)
}

export interface ProviderMount {
  button?: string
  embedded?: string
  embeddedPosition?: InsertPosition
}

export interface VideoProvider {
  id: string
  label?: string
  matches: string[]
  autoOpenScope?: "tab"
  defaults?: Partial<ProviderSettings>
  mount?: ProviderMount
  features?: ProviderFeature[]
  getPageKey: (url: URL) => string | null
  loadPreview: (context: ProviderContext) => Promise<PreviewData | null>
}
