import type { Settings } from "~runtime/types"

export const SETTINGS_KEY = "rtp:settings"

export const DEFAULT_SETTINGS: Settings = {
  displayMode: "embedded",
  autoOpen: true
}

export async function getSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get(SETTINGS_KEY)
  return {
    ...DEFAULT_SETTINGS,
    ...(stored[SETTINGS_KEY] || {})
  }
}

export async function setSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({
    [SETTINGS_KEY]: settings
  })
}
