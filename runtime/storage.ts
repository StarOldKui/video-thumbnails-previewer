import type { ProviderSettings, VideoProvider } from "~providers/types"

export const GLOBAL_DEFAULT_SETTINGS: ProviderSettings = {
  displayMode: "popup",
  autoOpen: false
}

export function getSettingsKey(providerId: string): string {
  return `vtp:${providerId}:settings`
}

export function getProviderDefaults(provider: VideoProvider): ProviderSettings {
  return {
    ...GLOBAL_DEFAULT_SETTINGS,
    ...provider.defaults
  }
}

export async function getSettings(provider: VideoProvider): Promise<ProviderSettings> {
  const key = getSettingsKey(provider.id)
  const stored = await chrome.storage.local.get(key)
  return {
    ...getProviderDefaults(provider),
    ...(stored[key] || {})
  }
}

export async function setSettings(
  provider: VideoProvider,
  settings: ProviderSettings
): Promise<void> {
  await chrome.storage.local.set({
    [getSettingsKey(provider.id)]: settings
  })
}
