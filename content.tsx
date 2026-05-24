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
import {
  RECURBATE_FEATURES,
  RECURBATE_MOUNT,
  loadRecurbatePreview
} from "~recurbate"
import {
  getRecurbatePageKey,
  isRecurbateUrl
} from "~recurbate/url"
import {
  fetchImages,
  findResource,
  openTabs,
  runRecurbateAction
} from "~runtime/background-client"
import { getSettings, SETTINGS_KEY } from "~runtime/storage"
import type { DisplayMode, PreviewData, PreviewState, Settings } from "~runtime/types"

export const config: PlasmoCSConfig = {
  matches: ["*://*.recu.me/*", "*://*.recu.club/*"],
  all_frames: false
}

export const getOverlayAnchor: PlasmoGetOverlayAnchor = async () =>
  document.body

export const getShadowHostId: PlasmoGetShadowHostId = () => "rtp-root"

export const getStyle: PlasmoGetStyle = () => {
  const style = document.createElement("style")
  style.textContent = cssText
  return style
}

interface OpenPreviewMessage {
  type: "rtp:open-preview"
  pageKey: string
  mode: DisplayMode
}

interface PortalMountProps {
  children: ReactNode
  hostTag?: "div" | "span"
  insertPosition?: InsertPosition
  selector: string
  variant: "button" | "embedded"
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
    const id = "rtp-page-styles"
    if (document.getElementById(id)) return

    const style = document.createElement("style")
    style.id = id
    style.textContent = cssText
    document.documentElement.appendChild(style)
  }, [])
}

function removeStaleMounts(): void {
  document
    .querySelectorAll("[data-rtp-mount], #rtp-popup-container")
    .forEach((element) => element.remove())
}

removeStaleMounts()

function useSettings(enabled: boolean): Settings | null {
  const [settings, setSettings] = useState<Settings | null>(null)

  useEffect(() => {
    let cancelled = false

    const reload = async () => {
      const nextSettings = enabled ? await getSettings() : null
      if (!cancelled) setSettings(nextSettings)
    }

    reload()

    const onChanged = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string
    ) => {
      if (areaName === "local" && changes[SETTINGS_KEY]) reload()
    }

    chrome.storage.onChanged.addListener(onChanged)
    return () => {
      cancelled = true
      chrome.storage.onChanged.removeListener(onChanged)
    }
  }, [enabled])

  return settings
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

    const removeDuplicateHosts = () => {
      document
        .querySelectorAll<HTMLElement>(`[data-rtp-mount="${variant}"]`)
        .forEach((element) => {
          if (element !== currentHost) element.remove()
        })
    }

    const mountIfNeeded = () => {
      const anchor = document.querySelector(selector)
      if (!anchor) {
        if (!currentHost?.isConnected) removeHost()
        return
      }

      if (!currentHost) {
        currentHost = document.createElement(hostTag)
        currentHost.dataset.rtpMount = variant

        if (variant === "button") {
          currentHost.style.display = "inline-flex"
          currentHost.style.margin = "0 6px"
        }

        setHost(currentHost)
      }

      if (currentHost.isConnected && currentAnchor === anchor) {
        removeDuplicateHosts()
        return
      }

      anchor.insertAdjacentElement(insertPosition, currentHost)
      currentAnchor = anchor
      removeDuplicateHosts()
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
  const isSupported = isRecurbateUrl(url)
  const pageKey = useMemo(() => getRecurbatePageKey(url), [url.href])
  const settings = useSettings(isSupported)
  const [previewState, setPreviewState] = useState<PreviewState | null>(null)
  const [data, setData] = useState<PreviewData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const closePreviewRef = useRef<() => Promise<void>>(async () => {})
  const loadedToken = useRef<string>("")
  const modeRef = useRef<DisplayMode>("popup")
  const togglePreviewRef = useRef<() => void>(() => {})

  useEffect(() => {
    return () => data?.cleanup?.()
  }, [data])

  const setPreviewVisible = useCallback(
    (visible: boolean, mode: DisplayMode) => {
      if (!pageKey) return

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
    [pageKey]
  )

  const closePreview = useCallback(async () => {
    if (!pageKey || !settings) return
    setPreviewVisible(false, previewState?.mode || settings.displayMode)
    setData(null)
    setError(null)
    setLoading(false)
  }, [pageKey, previewState?.mode, settings?.displayMode, setPreviewVisible])

  useEffect(() => {
    closePreviewRef.current = closePreview
  }, [closePreview])

  useEffect(() => {
    const isPreviewButtonEvent = (event: Event) =>
      event.target instanceof Element &&
      Boolean(event.target.closest(".rtp-button"))

    const stopPreviewButtonEvent = (event: Event) => {
      if (!isPreviewButtonEvent(event)) return
      event.stopPropagation()
    }

    const onPreviewButtonClick = (event: MouseEvent) => {
      if (!isPreviewButtonEvent(event)) return
      event.preventDefault()
      event.stopPropagation()
      togglePreviewRef.current()
    }

    document.addEventListener("pointerdown", stopPreviewButtonEvent, true)
    document.addEventListener("mousedown", stopPreviewButtonEvent, true)
    document.addEventListener("click", onPreviewButtonClick, true)

    return () => {
      document.removeEventListener("pointerdown", stopPreviewButtonEvent, true)
      document.removeEventListener("mousedown", stopPreviewButtonEvent, true)
      document.removeEventListener("click", onPreviewButtonClick, true)
    }
  }, [])

  const scrollToVideo = useCallback((selector = "video") => {
    document
      .querySelector(selector)
      ?.scrollIntoView({ behavior: "smooth", block: "center" })
  }, [])

  const visible = Boolean(
    pageKey && previewState?.visible && previewState.pageKey === pageKey
  )
  const mode =
    visible && previewState?.mode === "embedded" ? "embedded" : "popup"

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
    if (!isSupported) return

    const cleanups: Array<() => void> = []

    for (const feature of RECURBATE_FEATURES) {
      if (!feature.matches(url)) continue

      const cleanup = feature.mount({
        fetchImages,
        findResource,
        openTabs,
        runRecurbateAction
      })

      if (typeof cleanup === "function") cleanups.push(cleanup)
    }

    return () => cleanups.forEach((cleanup) => cleanup())
  }, [isSupported, url.href])

  useEffect(() => {
    loadedToken.current = ""
    setData(null)
    setError(null)
    setLoading(false)

    if (!pageKey || !settings?.autoOpen) {
      setPreviewState(null)
      return
    }

    setPreviewVisible(true, settings.displayMode)
  }, [pageKey, settings?.autoOpen, setPreviewVisible])

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
    if (!pageKey || !settings) return

    setPreviewState((currentState) => {
      const isVisible =
        currentState?.visible === true && currentState.pageKey === pageKey

      return {
        visible: !isVisible,
        mode: isVisible ? currentState.mode : settings.displayMode,
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
      if (message?.type !== "rtp:open-preview") return

      const currentPageKey = getRecurbatePageKey(new URL(location.href))
      if (!currentPageKey || message.pageKey !== currentPageKey) {
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
    if (!pageKey || !settings || !visible || !previewState) return

    const token = `${pageKey}:${previewState.updatedAt}`
    if (loadedToken.current === token) return
    loadedToken.current = token

    let cancelled = false
    const controller = new AbortController()

    setLoading(true)
    setError(null)
    setData(null)

    loadRecurbatePreview({
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
      runRecurbateAction: <TResponse = unknown,>(
        action: string,
        payload?: unknown
      ) => runRecurbateAction<TResponse>(action, payload, controller.signal)
    })
      .then((result) => {
        if (cancelled) return
        setData(result)
      })
      .catch((loadError) => {
        if (cancelled || controller.signal.aborted) return
        setData(null)
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
    pageKey,
    Boolean(settings),
    visible,
    previewState?.updatedAt,
    scrollToVideo
  ])

  if (!isSupported || !settings || !pageKey) return null

  const panel = (
    <PreviewPanel
      data={data}
      error={error}
      loading={loading}
      mode={mode}
      onClose={closePreview}
      title="Recurbate Thumbnails Previewer"
    />
  )

  return (
    <div className="rtp-root">
      <PortalMount
        hostTag="span"
        selector={RECURBATE_MOUNT.button}
        variant="button">
        <button
          className="rtp-button rtp-button-recurbate plyr__control"
          type="button">
          Thumbnails
        </button>
      </PortalMount>

      {visible && mode === "embedded" ? (
        <PortalMount
          insertPosition={RECURBATE_MOUNT.embeddedPosition || "afterbegin"}
          selector={RECURBATE_MOUNT.embedded}
          variant="embedded">
          {panel}
        </PortalMount>
      ) : null}

      {visible && mode === "popup" ? <BodyPortal>{panel}</BodyPortal> : null}
    </div>
  )
}
