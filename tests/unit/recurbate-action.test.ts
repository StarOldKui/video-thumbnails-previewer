import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  runMainWorld: vi.fn()
}))

vi.mock("~background/run-main-world", () => ({
  runMainWorld: mocks.runMainWorld
}))

import recurbateActionHandler from "~background/messages/recurbate-action"

async function sendRecurbateAction(body: unknown, senderUrl: string) {
  let response: unknown
  const res = {
    send: vi.fn((nextResponse: unknown) => {
      response = nextResponse
    })
  }

  await recurbateActionHandler(
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

describe("recurbate-action handler", () => {
  beforeEach(() => {
    mocks.runMainWorld.mockReset()
  })

  it("rejects unknown actions", async () => {
    await expect(
      sendRecurbateAction(
        {
          action: "missing-action"
        },
        "https://recu.me/demo/video/123/play"
      )
    ).resolves.toMatchObject({
      success: false,
      error: "Unknown Recurbate action: missing-action"
    })
  })

  it("denies actions from a non-Recurbate sender URL", async () => {
    const response = await sendRecurbateAction(
      {
        action: "seek",
        payload: {
          timestamp: 120
        }
      },
      "https://example.com/video/123"
    )

    expect(response).toMatchObject({
      success: false,
      error: "Recurbate action denied"
    })
    expect(mocks.runMainWorld).not.toHaveBeenCalled()
  })

  it.each([
    "https://recu.me/demo/video/123/play",
    "https://recu.club/mon1_day/video/183056343/play"
  ])("dispatches seek actions from %s", async (senderUrl) => {
    mocks.runMainWorld.mockResolvedValue({
      success: true
    })

    const response = await sendRecurbateAction(
      {
        action: "seek",
        payload: {
          timestamp: 120
        }
      },
      senderUrl
    )

    expect(response).toEqual({
      success: true,
      data: null
    })
    expect(mocks.runMainWorld).toHaveBeenCalledWith(
      1,
      expect.any(Function),
      [120]
    )
  })
})
