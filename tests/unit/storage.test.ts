import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  getProviderDefaults,
  getSettings,
  getSettingsKey,
  setSettings
} from "~runtime/storage"
import type { VideoProvider } from "~providers/types"

let storageGet: ReturnType<typeof vi.fn>
let storageSet: ReturnType<typeof vi.fn>

const provider: VideoProvider = {
  id: "example",
  defaults: {
    displayMode: "embedded",
    autoOpen: true
  },
  matches: ["*://example.com/*"],
  getPageKey: () => "page",
  loadPreview: async () => null
}

describe("storage", () => {
  beforeEach(() => {
    storageGet = vi.fn()
    storageSet = vi.fn()

    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: storageGet,
          set: storageSet
        }
      }
    })
  })

  it("derives provider settings keys from provider id", () => {
    expect(getSettingsKey("youtube")).toBe("vtp:youtube:settings")
  })

  it("merges global defaults with provider defaults and stored values", async () => {
    storageGet.mockResolvedValue({
      [getSettingsKey(provider.id)]: {
        autoOpen: false
      }
    })

    await expect(getSettings(provider)).resolves.toEqual({
      displayMode: "embedded",
      autoOpen: false
    })
    expect(getProviderDefaults(provider)).toEqual({
      displayMode: "embedded",
      autoOpen: true
    })
  })

  it("writes settings to the provider-derived key", async () => {
    storageSet.mockResolvedValue(undefined)

    await setSettings(provider, {
      displayMode: "popup",
      autoOpen: false
    })

    expect(storageSet).toHaveBeenCalledWith({
      [getSettingsKey(provider.id)]: {
        displayMode: "popup",
        autoOpen: false
      }
    })
  })
})
