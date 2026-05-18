import { describe, expect, it } from "vitest"

import type { PreviewData } from "~providers/types"
import {
  createSpriteGridPreview,
  recoverGeneratedTimestamps
} from "~runtime/processing"

function createData(): PreviewData {
  return {
    thumbnails: [
      { dataUrl: "a", index: 0 },
      { dataUrl: "b", index: 1 },
      { dataUrl: "c", index: 2, timestamp: 10 }
    ],
    metadata: {
      totalThumbnails: 4
    },
    seekToTime: () => {}
  }
}

describe("processing", () => {
  it("recovers missing generated timestamps when duration becomes available", () => {
    const recovered = recoverGeneratedTimestamps(createData(), 40)

    expect(recovered.metadata.videoDuration).toBe(40)
    expect(recovered.thumbnails.map((thumbnail) => thumbnail.timestamp)).toEqual([
      0,
      10,
      10
    ])
  })

  it("keeps data unchanged without a valid duration", () => {
    const data = createData()

    expect(recoverGeneratedTimestamps(data, undefined)).toBe(data)
    expect(recoverGeneratedTimestamps(data, 0)).toBe(data)
  })

  it("creates raw sprite thumbnails without background image downloads", () => {
    const data = createSpriteGridPreview({
      columns: 2,
      frameHeight: 50,
      frameWidth: 100,
      rows: 2,
      sampleRate: 1,
      urls: ["https://example.com/sprite.jpg"],
      videoDuration: 20
    })

    expect(data.metadata.totalThumbnails).toBe(2)
    expect(data.thumbnails[0]).toMatchObject({
      dataUrl: "https://example.com/sprite.jpg",
      index: 0,
      sprite: {
        imageHeight: 100,
        imageWidth: 200,
        sourceHeight: 50,
        sourceWidth: 100,
        sourceX: 0,
        sourceY: 0
      },
      timestamp: 0
    })
    expect(data.thumbnails[1].sprite).toMatchObject({
      sourceX: 0,
      sourceY: 50
    })
    expect(data.thumbnails[1].timestamp).toBe(10)
  })
})
