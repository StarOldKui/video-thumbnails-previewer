import type {
  PlasmoCSConfig,
  PlasmoGetOverlayAnchor,
  PlasmoGetShadowHostId,
  PlasmoGetStyle
} from "plasmo"
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react"
import { createPortal } from "react-dom"

import cssText from "data-text:~style.css"
import { PreviewPanel } from "~components/PreviewPanel"
import { findHostProviders, findProvider } from "~providers/registry"
import type {
  DisplayMode,
  PreviewData,
  PreviewState,
  ProviderSettings,
  VideoProvider
} from "~providers/types"
import {
  fetchImages,
  findResource,
  openTabs,
  runProviderAction
} from "~runtime/background-client"
import {
  recoverGeneratedTimestamps,
  waitForVideoDuration
} from "~runtime/processing"
import { getSettingsKey, getSettings } from "~runtime/storage"

export const config: PlasmoCSConfig = {
  matches: [
    "*://*.youtube.com/*",
    "*://*.twitch.tv/*",
    "*://*.recu.me/*",
    "*://*.missav.ws/*",
    "*://*.missav.com/*",
    "*://*.pornhub.com/view_video.php*",
    "*://*.pornhub.com/model/*/videos*",
    "*://*.pimpbunny.com/videos/*"
  ],
  all_frames: false
}

export const getOverlayAnchor: PlasmoGetOverlayAnchor = async () =>
  document.body

export const getShadowHostId: PlasmoGetShadowHostId = () => "vtp-root"

export const getStyle: PlasmoGetStyle = () => {
  const style = document.createElement("style")
  style.textContent = cssText
  return style
}

function useCurrentUrl(): URL {
  const [href, setHref] = useState(location.href)

  useEffect(() => {
    const updateHref = () => {
      setHref((currentHref) =>
        currentHref === location.href ? currentHref : location.href
      )
    }

    const originalPushState = history.pushState
    const originalReplaceState = history.replaceState

    history.pushState = function (...args: Parameters<History["pushState"]>) {
      const result = originalPushState.apply(this, args)
      updateHref()
      return result
    }

    history.replaceState = function (
      ...args: Parameters<History["replaceState"]>
    ) {
      const result = originalReplaceState.apply(this, args)
      updateHref()
      return result
    }

    window.addEventListener("popstate", updateHref)
    const timer = window.setInterval(updateHref, 500)

    return () => {
      history.pushState = originalPushState
      history.replaceState = originalReplaceState
      window.removeEventListener("popstate", updateHref)
      window.clearInterval(timer)
    }
  }, [])

  return useMemo(() => new URL(href), [href])
}

function usePageStyles(): void {
  useEffect(() => {
    const id = "vtp-page-styles"
    if (document.getElementById(id)) return

    const style = document.createElement("style")
    style.id = id
    style.textContent = cssText
    document.documentElement.appendChild(style)
  }, [])
}

interface OpenPreviewMessage {
  type: "vtp:open-preview"
  providerId: string
  pageKey: string
  mode: DisplayMode
}

function useSettings(
  provider: VideoProvider | null,
  pageKey: string | null
): ProviderSettings | null {
  const [settings, setSettings] = useState<ProviderSettings | null>(null)
  const settingsKey = provider ? getSettingsKey(provider.id) : null

  const reload = async () => {
    if (!provider || !pageKey) {
      setSettings(null)
      return
    }

    setSettings(await getSettings(provider))
  }

  useEffect(() => {
    reload()

    const onChanged = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string
    ) => {
      if (
        areaName === "local" &&
        settingsKey &&
        changes[settingsKey]
      ) {
        reload()
      }
    }

    chrome.storage.onChanged.addListener(onChanged)
    return () => chrome.storage.onChanged.removeListener(onChanged)
  }, [provider?.id, pageKey, settingsKey])

  return settings
}

interface PortalMountProps {
  children: ReactNode
  hostTag?: "div" | "span"
  insertPosition?: InsertPosition
  selector: string
  variant: "button" | "embedded"
}

function PortalMount({
  children,
  hostTag = "div",
  insertPosition = "afterend",
  selector,
  variant
}: PortalMountProps) {
  const [host, setHost] = useState<HTMLElement | null>(null)

  useEffect(() => {
    let currentAnchor: Element | null = null
    let currentHost: HTMLElement | null = null

    const removeHost = () => {
      currentHost?.remove()
      currentAnchor = null
      currentHost = null
      setHost(null)
    }

    const removeOtherHosts = () => {
      const mounts = Array.from(
        document.querySelectorAll<HTMLElement>(`[data-vtp-mount="${variant}"]`)
      )

      mounts.forEach((mount) => {
        if (mount !== currentHost) mount.remove()
      })
    }

    const removeStaleChildren = () => {
      while (currentHost && currentHost.children.length > 1) {
        currentHost.firstElementChild?.remove()
      }
    }

    const mountIfNeeded = () => {
      removeOtherHosts()
      const anchor = document.querySelector(selector)
      if (!anchor) {
        removeHost()
        return
      }
      if (currentHost?.isConnected && currentAnchor === anchor) {
        removeStaleChildren()
        return
      }

      removeHost()

      const nextHost = document.createElement(hostTag)
      nextHost.dataset.vtpMount = variant

      if (variant === "button") {
        nextHost.style.display = "inline-flex"
        nextHost.style.margin = "0 6px"
        anchor.insertAdjacentElement(insertPosition, nextHost)
      } else {
        anchor.insertAdjacentElement(insertPosition, nextHost)
      }

      currentHost = nextHost
      currentAnchor = anchor
      setHost(nextHost)
    }

    mountIfNeeded()
    const timer = window.setInterval(mountIfNeeded, 500)

    return () => {
      window.clearInterval(timer)
      removeHost()
    }
  }, [hostTag, insertPosition, selector, variant])

  return host ? createPortal(children, host) : null
}

function BodyPortal({ children }: { children: ReactNode }) {
  return document.body ? createPortal(children, document.body) : null
}

export default function ContentApp() {
  usePageStyles()

  const url = useCurrentUrl()
  const provider = useMemo(() => findProvider(url), [url.href])
  const hostProviders = useMemo(() => findHostProviders(url), [url.href])
  const pageKey = useMemo(
    () => (provider ? provider.getPageKey(url) : null),
    [provider?.id, url.href]
  )
  const settings = useSettings(provider, pageKey)
  const [previewState, setPreviewState] = useState<PreviewState | null>(null)
  const [data, setData] = useState<PreviewData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const autoOpenedProviders = useRef<Set<string>>(new Set())
  const closePreviewRef = useRef<() => Promise<void>>(async () => {})
  const loadedToken = useRef<string>("")
  const modeRef = useRef<DisplayMode>("popup")
  const togglePreviewRef = useRef<() => void>(() => {})

  useEffect(() => {
    return () => data?.cleanup?.()
  }, [data])

  const setPreviewVisible = useCallback(
    (visible: boolean, mode: DisplayMode) => {
      if (!provider || !pageKey) return

      setPreviewState((currentState) => {
        if (
          currentState?.visible === visible &&
          currentState.mode === mode &&
          currentState.pageKey === pageKey
        ) {
          return currentState
        }

        return {
          visible,
          mode,
          pageKey,
          updatedAt: Date.now()
        }
      })
    },
    [provider?.id, pageKey]
  )

  const closePreview = useCallback(async () => {
    if (!provider || !pageKey || !settings) return
    setPreviewVisible(false, previewState?.mode || settings.displayMode)
    setData(null)
    setError(null)
    setLoading(false)
  }, [
    provider?.id,
    pageKey,
    previewState?.mode,
    settings?.displayMode,
    setPreviewVisible
  ])

  useEffect(() => {
    closePreviewRef.current = closePreview
  }, [closePreview])

  const scrollToVideo = useCallback((selector = "video") => {
    document
      .querySelector(selector)
      ?.scrollIntoView({ behavior: "smooth", block: "center" })
  }, [])

  const visible =
    Boolean(provider && pageKey && previewState?.visible) &&
    previewState?.pageKey === pageKey
  const canRenderEmbedded =
    visible && previewState?.mode === "embedded" && provider?.mount?.embedded
  const mode = canRenderEmbedded ? "embedded" : "popup"

  useEffect(() => {
    modeRef.current = mode
  }, [mode])

  const afterThumbnailSeek = useCallback(async (videoSelector = "video") => {
    if (modeRef.current === "embedded") {
      scrollToVideo(videoSelector)
      return
    }

    await closePreviewRef.current()
  }, [scrollToVideo])

  useEffect(() => {
    const cleanups: Array<() => void> = []

    for (const hostProvider of hostProviders) {
      if (!hostProvider.features?.length) continue

      for (const feature of hostProvider.features) {
        if (!feature.matches(url)) continue
        const cleanup = feature.mount({
          fetchImages,
          findResource,
          openTabs,
          runProviderAction: <TResponse = unknown,>(
            action: string,
            payload?: unknown
          ) =>
            runProviderAction<TResponse>(hostProvider.id, action, payload)
        })
        if (typeof cleanup === "function") cleanups.push(cleanup)
      }
    }

    return () => cleanups.forEach((cleanup) => cleanup())
  }, [hostProviders, url.href])

  useEffect(() => {
    if (!provider || !pageKey || !settings?.autoOpen) return

    if (provider.autoOpenScope === "tab") {
      if (autoOpenedProviders.current.has(provider.id)) return
      autoOpenedProviders.current.add(provider.id)
    }

    setPreviewVisible(true, settings.displayMode)
  }, [
    provider?.id,
    provider?.autoOpenScope,
    pageKey,
    settings?.autoOpen,
    setPreviewVisible
  ])

  useEffect(() => {
    if (!pageKey || !settings) return

    setPreviewState((currentState) => {
      if (!currentState?.visible) return currentState
      if (currentState.pageKey !== pageKey) return currentState
      if (currentState.mode === settings.displayMode) return currentState

      return {
        ...currentState,
        mode: settings.displayMode
      }
    })
  }, [pageKey, settings?.displayMode])

  togglePreviewRef.current = () => {
    if (!provider || !pageKey || !settings) return

    setPreviewState((currentState) => {
      const isVisible =
        currentState?.visible === true && currentState.pageKey === pageKey

      return {
        visible: !isVisible,
        mode: isVisible
          ? currentState.mode
          : settings.displayMode,
        pageKey,
        updatedAt: Date.now()
      }
    })
  }

  useEffect(() => {
    const onMessage = (
      message: OpenPreviewMessage,
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response?: unknown) => void
    ) => {
      if (message?.type !== "vtp:open-preview") return
      const currentUrl = new URL(location.href)
      const currentProvider = findProvider(currentUrl)
      const currentPageKey = currentProvider?.getPageKey(currentUrl) || null

      if (
        !currentProvider ||
        !currentPageKey ||
        message.providerId !== currentProvider.id ||
        message.pageKey !== currentPageKey
      ) {
        sendResponse({ success: false })
        return
      }

      setPreviewState({
        visible: true,
        mode: message.mode,
        pageKey: currentPageKey,
        updatedAt: Date.now()
      })
      sendResponse({ success: true })
    }

    chrome.runtime.onMessage.addListener(onMessage)
    return () => chrome.runtime.onMessage.removeListener(onMessage)
  }, [])

  useEffect(() => {
    setPreviewState((currentState) => {
      if (!currentState || !pageKey) return null
      if (currentState.pageKey === pageKey) return currentState
      if (!currentState.visible) return null

      return {
        ...currentState,
        pageKey,
        updatedAt: Date.now()
      }
    })
    setData(null)
    setError(null)
    setLoading(false)
    loadedToken.current = ""
  }, [provider?.id, pageKey])

  useEffect(() => {
    if (!provider || !pageKey || !settings || !visible || !previewState) return

    const token = `${provider.id}:${pageKey}:${previewState.updatedAt}`
    if (loadedToken.current === token) return
    loadedToken.current = token

    let cancelled = false
    const controller = new AbortController()
    const loadContext = {
      pageKey,
      settings,
      afterThumbnailSeek,
      closePreview: () => closePreviewRef.current(),
      openTabs,
      scrollToVideo,
      signal: controller.signal,
      fetchImages: (urls: string[]) => fetchImages(urls, controller.signal),
      findResource: (videoUrl: string, pattern: string, timeoutMs?: number) =>
        findResource(videoUrl, pattern, timeoutMs, controller.signal),
      runProviderAction: <TResponse = unknown,>(
        action: string,
        payload?: unknown
      ) =>
        runProviderAction<TResponse>(
          provider.id,
          action,
          payload,
          controller.signal
        )
    }
    setLoading(true)
    setError(null)
    setData(null)

    provider
      .loadPreview(loadContext)
      .then((result) => {
        if (cancelled) return
        setData(result)
      })
      .catch((loadError) => {
        if (cancelled) return
        if (controller.signal.aborted) return
        setError(
          loadError instanceof Error ? loadError.message : String(loadError)
        )
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
      controller.abort()
      if (loadedToken.current === token) loadedToken.current = ""
    }
  }, [
    afterThumbnailSeek,
    provider?.id,
    pageKey,
    Boolean(settings),
    visible,
    previewState?.updatedAt,
    scrollToVideo
  ])

  useEffect(() => {
    if (!data?.seekToTime) return
    if (data.thumbnails.some((thumbnail) => typeof thumbnail.timestamp === "number")) return
    if (data.metadata.videoDuration) {
      setData((currentData) =>
        currentData === data
          ? recoverGeneratedTimestamps(currentData, data.metadata.videoDuration)
          : currentData
      )
      return
    }

    let cancelled = false

    waitForVideoDuration(document.querySelector("video"), 30000).then(
      (duration) => {
        if (cancelled || !duration) return
        setData((currentData) =>
          currentData === data
            ? recoverGeneratedTimestamps(currentData, duration)
            : currentData
        )
      }
    )

    return () => {
      cancelled = true
    }
  }, [data])

  if (!provider || !pageKey || !settings) return null

  const title = "Video Thumbnails Previewer"
  const panel = (
    <PreviewPanel
      data={data}
      error={error}
      loading={loading}
      mode={mode}
      onClose={closePreview}
      title={title}
    />
  )

  return (
    <div className="vtp-root">
      {provider.mount?.button ? (
        <PortalMount
          hostTag="span"
          selector={provider.mount.button}
          variant="button">
          <button
            className={`vtp-button vtp-button-${provider.id}${
              provider.id === "recurbate" ||
              provider.id === "missav" ||
              provider.id === "pornhub"
                ? " plyr__control"
                : ""
            }`}
            onClick={() => togglePreviewRef.current()}
            type="button">
            Thumbnails
          </button>
        </PortalMount>
      ) : null}

      {visible && mode === "embedded" && provider.mount?.embedded ? (
        <PortalMount
          insertPosition={provider.mount.embeddedPosition || "afterbegin"}
          selector={provider.mount.embedded}
          variant="embedded">
          {panel}
        </PortalMount>
      ) : null}

      {visible && mode === "popup" ? <BodyPortal>{panel}</BodyPortal> : null}
    </div>
  )
}
