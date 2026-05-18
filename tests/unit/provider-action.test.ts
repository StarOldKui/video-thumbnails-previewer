import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  runMainWorld: vi.fn()
}))

vi.mock("~background/run-main-world", () => ({
  runMainWorld: mocks.runMainWorld
}))

import providerActionHandler from "~background/messages/provider-action"

async function sendProviderAction(body: unknown, senderUrl: string) {
  let response: unknown
  const res = {
    send: vi.fn((nextResponse: unknown) => {
      response = nextResponse
    })
  }

  await providerActionHandler(
    {
      body,
      sender: {
        tab: {
          id: 1,
          url: senderUrl
        }
      }
    } as any,
    res as any
  )

  return response as { success: boolean; data?: unknown; error?: string }
}

describe("provider-action handler", () => {
  beforeEach(() => {
    mocks.runMainWorld.mockReset()
  })

  it("rejects unknown provider actions", async () => {
    await expect(
      sendProviderAction(
        {
          providerId: "missav",
          action: "missing-action"
        },
        "https://missav.ws/en/abc-123"
      )
    ).resolves.toMatchObject({
      success: false,
      error: "Unknown action: missav/missing-action"
    })
  })

  it("denies actions from a mismatched sender URL", async () => {
    const response = await sendProviderAction(
      {
        providerId: "missav",
        action: "thumbnail-urls"
      },
      "https://www.youtube.com/watch?v=abc"
    )

    expect(response).toMatchObject({
      success: false,
      error: "Provider action denied"
    })
    expect(mocks.runMainWorld).not.toHaveBeenCalled()
  })

  it("denies PimpBunny actions from non-video pages", async () => {
    const response = await sendProviderAction(
      {
        providerId: "pimpbunny",
        action: "thumbnail-urls",
        payload: {
          videoId: "12345"
        }
      },
      "https://pimpbunny.com/categories/"
    )

    expect(response).toMatchObject({
      success: false,
      error: "Provider action denied"
    })
  })

  it("dispatches allowed provider actions", async () => {
    mocks.runMainWorld.mockResolvedValue({
      success: true,
      urls: ["https://example.com/thumb.jpg"]
    })

    const response = await sendProviderAction(
      {
        providerId: "missav",
        action: "thumbnail-urls"
      },
      "https://missav.ws/en/abc-123"
    )

    expect(response).toEqual({
      success: true,
      data: ["https://example.com/thumb.jpg"]
    })
    expect(mocks.runMainWorld).toHaveBeenCalledWith(1, expect.any(Function))
  })
})
