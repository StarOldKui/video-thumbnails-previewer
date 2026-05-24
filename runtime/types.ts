export type DisplayMode = "popup" | "embedded"

export interface Settings {
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

export interface PreviewContext {
  pageKey: string
  settings: Settings
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
  runRecurbateAction: <TResponse = unknown>(
    action: string,
    payload?: unknown
  ) => Promise<TResponse>
  scrollToVideo: (selector?: string) => void
}

export interface FeatureContext {
  fetchImages: (urls: string[]) => Promise<string[]>
  findResource: (
    videoUrl: string,
    pattern: string,
    timeoutMs?: number
  ) => Promise<string | null>
  openTabs: (urls: string[]) => Promise<number>
  runRecurbateAction: <TResponse = unknown>(
    action: string,
    payload?: unknown
  ) => Promise<TResponse>
}

export interface RecurbateFeature {
  id?: string
  matches: (url: URL) => boolean
  mount: (context: FeatureContext) => void | (() => void)
}

export interface RecurbateMount {
  button: string
  embedded: string
  embeddedPosition?: InsertPosition
}
