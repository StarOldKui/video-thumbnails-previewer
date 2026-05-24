import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  DEFAULT_SETTINGS,
  SETTINGS_KEY,
  getSettings,
  setSettings
} from "~runtime/storage"

let storageGet: ReturnType<typeof vi.fn>
let storageSet: ReturnType<typeof vi.fn>

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

  it("uses one Recurbate settings key", () => {
    expect(SETTINGS_KEY).toBe("rtp:settings")
    expect(DEFAULT_SETTINGS).toEqual({
      displayMode: "embedded",
      autoOpen: true
    })
  })

  it("merges defaults with stored values", async () => {
    storageGet.mockResolvedValue({
      [SETTINGS_KEY]: {
        autoOpen: false
      }
    })

    await expect(getSettings()).resolves.toEqual({
      displayMode: "embedded",
      autoOpen: false
    })
  })

  it("writes settings to the Recurbate key", async () => {
    storageSet.mockResolvedValue(undefined)

    await setSettings({
      displayMode: "popup",
      autoOpen: false
    })

    expect(storageSet).toHaveBeenCalledWith({
      [SETTINGS_KEY]: {
        displayMode: "popup",
        autoOpen: false
      }
    })
  })
})
