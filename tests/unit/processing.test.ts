import { describe, expect, it } from "vitest"

import { formatDuration, waitForVideoDuration } from "~runtime/processing"

describe("processing", () => {
  it("formats short and long durations", () => {
    expect(formatDuration(0)).toBe("0:00")
    expect(formatDuration(65)).toBe("1:05")
    expect(formatDuration(3723)).toBe("1:02:03")
  })

  it("returns undefined without a video element", async () => {
    await expect(waitForVideoDuration(null)).resolves.toBeUndefined()
  })
})
