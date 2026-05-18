import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  sendToBackground: vi.fn()
}))

vi.mock("@plasmohq/messaging", () => ({
  sendToBackground: mocks.sendToBackground
}))

import {
  fetchImages,
  findResource,
  openTabs,
  runProviderAction
} from "~runtime/background-client"

describe("background client", () => {
  beforeEach(() => {
    mocks.sendToBackground.mockReset()
  })

  it("sends provider id with provider actions", async () => {
    mocks.sendToBackground.mockResolvedValue({
      success: true,
      data: ["ok"]
    })

    await expect(
      runProviderAction("missav", "thumbnail-urls", { pageKey: "abc" })
    ).resolves.toEqual(["ok"])

    expect(mocks.sendToBackground).toHaveBeenCalledWith({
      name: "provider-action",
      body: {
        providerId: "missav",
        action: "thumbnail-urls",
        payload: { pageKey: "abc" }
      }
    })
  })

  it("wraps image fetch, resource lookup, and tab opening responses", async () => {
    mocks.sendToBackground
      .mockResolvedValueOnce({ success: true, dataUrls: ["data:image/png;base64,a"] })
      .mockResolvedValueOnce({ success: true, url: "https://example.com/a.jpg" })
      .mockResolvedValueOnce({ success: true, openedCount: 2 })

    await expect(fetchImages(["https://example.com/a.jpg"])).resolves.toEqual([
      "data:image/png;base64,a"
    ])
    await expect(findResource("https://example.com/video", "-stripe", 1000)).resolves.toBe(
      "https://example.com/a.jpg"
    )
    await expect(openTabs(["https://a.example", "https://b.example"])).resolves.toBe(2)
  })

  it("throws response errors", async () => {
    mocks.sendToBackground.mockResolvedValue({
      success: false,
      error: "Nope"
    })

    await expect(fetchImages(["https://example.com/a.jpg"])).rejects.toThrow(
      "Nope"
    )
  })

  it("sends a cancel request when an abortable message is aborted", async () => {
    mocks.sendToBackground.mockImplementation((message) => {
      if (message.name === "cancel-request") return Promise.resolve({ success: true })
      return new Promise(() => {})
    })

    const controller = new AbortController()
    const request = fetchImages(["https://example.com/a.jpg"], controller.signal)
    controller.abort()

    await expect(request).rejects.toThrow("Request aborted")
    expect(mocks.sendToBackground).toHaveBeenCalledWith({
      name: "cancel-request",
      body: {
        requestId: expect.stringMatching(/^fetch-images:/)
      }
    })
  })
})
