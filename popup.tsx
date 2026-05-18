import { useEffect, useMemo, useState, type ReactNode } from "react"

import logoUrl from "url:assets/icon.rounded.png"
import "~style.css"
import { findHostProvider } from "~providers/registry"
import type { ProviderSettings, VideoProvider } from "~providers/types"
import { getSettings, setSettings } from "~runtime/storage"

interface ActiveTab {
  id: number
  url: URL
}

interface ActiveSite {
  provider: VideoProvider
  pageKey: string | null
}

async function getActiveTab(): Promise<ActiveTab | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id || !tab.url) return null

  try {
    return {
      id: tab.id,
      url: new URL(tab.url)
    }
  } catch {
    return null
  }
}

function getDomain(url: URL | null): string {
  if (!url) return "Unknown site"
  return url.hostname.replace(/^www\./, "")
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function sendOpenPreview(tabId: number, message: unknown): Promise<boolean> {
  for (const delay of [0, 100, 300, 700]) {
    if (delay) await sleep(delay)

    try {
      const response = await chrome.tabs.sendMessage(tabId, message)
      if (response?.success) return true
    } catch {}
  }

  return false
}

function PopupFrame({ children }: { children: ReactNode }) {
  return (
    <main className="vtp-popup-shell">
      <div className="vtp-popup-background" />
      <div className="vtp-popup-glow vtp-popup-glow-top" />
      <div className="vtp-popup-glow vtp-popup-glow-bottom" />
      <div className="vtp-popup-content">
        <div className="vtp-popup-header">
          <img
            alt="Video Thumbnails Previewer Logo"
            className="vtp-popup-logo"
            src={logoUrl}
          />
          <div className="vtp-popup-brand">Video Thumbnails Previewer</div>
        </div>
        {children}
      </div>
    </main>
  )
}

export default function Popup() {
  const [activeSite, setActiveSite] = useState<ActiveSite | null>(null)
  const [activeUrl, setActiveUrl] = useState<URL | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [settings, setSettingsState] = useState<ProviderSettings | null>(null)

  useEffect(() => {
    const previousMargin = document.body.style.margin
    const previousBackground = document.body.style.background
    document.body.style.margin = "0"
    document.body.style.background = "#111827"

    return () => {
      document.body.style.margin = previousMargin
      document.body.style.background = previousBackground
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        const tab = await getActiveTab()
        if (cancelled) return
        setActiveUrl(tab?.url || null)

        const provider = tab?.url ? findHostProvider(tab.url) : null
        if (!provider || !tab?.url) return

        const nextSettings = await getSettings(provider)
        if (cancelled) return
        setActiveSite({
          provider,
          pageKey: provider.getPageKey(tab.url)
        })
        setSettingsState(nextSettings)
      } catch {
        if (cancelled) return
        setActiveSite(null)
        setSettingsState(null)
      } finally {
        if (!cancelled) setLoaded(true)
      }
    }

    init()

    return () => {
      cancelled = true
    }
  }, [])

  const canUseEmbedded = useMemo(
    () => Boolean(activeSite?.provider.mount?.embedded),
    [activeSite?.provider.id]
  )

  const updateSettings = async (next: ProviderSettings) => {
    if (!activeSite) return
    setSettingsState(next)
    await setSettings(activeSite.provider, next)
  }

  const openPreview = async () => {
    if (!settings) return

    setPreviewError(null)
    const tab = await getActiveTab()
    const provider = tab?.url ? findHostProvider(tab.url) : null
    const pageKey = provider?.getPageKey(tab.url) || null
    if (!tab || !provider || !pageKey) return

    const opened = await sendOpenPreview(tab.id, {
      type: "vtp:open-preview",
      providerId: provider.id,
      pageKey,
      mode: settings.displayMode
    })
    if (opened) {
      window.close()
      return
    }
    setPreviewError("Preview could not be opened. Please try again.")
  }

  if (!activeSite || !settings) {
    return (
      <PopupFrame>
        {!loaded ? (
          <div className="vtp-popup-loader" aria-label="Loading">
            <span />
            <span />
            <span />
          </div>
        ) : (
          <section className="vtp-popup-card">
            <div className="vtp-popup-card-row">
              <div className="vtp-popup-site-name">{getDomain(activeUrl)}</div>
              <span className="vtp-popup-status vtp-popup-status-muted">
                Not Supported
              </span>
            </div>
            <p className="vtp-popup-muted">This page is not supported yet.</p>
          </section>
        )}
      </PopupFrame>
    )
  }

  return (
    <PopupFrame>
      <section className="vtp-popup-card">
        <div className="vtp-popup-card-row">
          <div className="vtp-popup-site-name">
            {activeSite.provider.label || activeSite.provider.id}
          </div>
          <span className="vtp-popup-status vtp-popup-status-active">
            Activated
          </span>
        </div>
      </section>

      <section className="vtp-popup-card">
        <div className="vtp-popup-section-title">
          <span className="vtp-popup-section-icon" />
          Display Settings
        </div>

        <div className="vtp-display-toggle">
          <button
            className={
              settings.displayMode === "popup"
                ? "vtp-display-option vtp-display-option-active"
                : "vtp-display-option"
            }
            onClick={() =>
              updateSettings({
                ...settings,
                displayMode: "popup"
              })
            }
            type="button">
            Popup
          </button>
          <button
            className={
              settings.displayMode === "embedded"
                ? "vtp-display-option vtp-display-option-active"
                : "vtp-display-option"
            }
            disabled={!canUseEmbedded}
            onClick={() =>
              canUseEmbedded &&
              updateSettings({
                ...settings,
                displayMode: "embedded"
              })
            }
            type="button">
            Embedded
          </button>
        </div>

        <div className="vtp-popup-toggle-row">
          <span>Auto Trigger</span>
          <button
            aria-pressed={settings.autoOpen}
            className={
              settings.autoOpen
                ? "vtp-switch vtp-switch-active"
                : "vtp-switch"
            }
            onClick={() =>
              updateSettings({
                ...settings,
                autoOpen: !settings.autoOpen
              })
            }
            type="button">
            <span />
          </button>
        </div>

        <div className="vtp-popup-divider" />

        <button
          className="vtp-generate-button"
          disabled={!activeSite.pageKey}
          onClick={openPreview}
          type="button">
          <span className="vtp-generate-icon" />
          Generate Preview
        </button>
        {!activeSite.pageKey ? (
          <p className="vtp-popup-muted">
            Open a supported video page to generate previews.
          </p>
        ) : null}
        {previewError ? <p className="vtp-popup-muted">{previewError}</p> : null}
      </section>
    </PopupFrame>
  )
}
