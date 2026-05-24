import type { PlasmoMessaging } from "@plasmohq/messaging"

import {
  registerRequest,
  unregisterRequest
} from "~background/request-registry"
import { recurbateActions } from "~recurbate/background"
import { isRecurbateHost } from "~recurbate/url"

interface RecurbateActionRequest {
  action: string
  payload?: unknown
  requestId?: string
}

interface RecurbateActionResponse {
  success: boolean
  data?: unknown
  error?: string
}

async function getSenderUrl(sender?: chrome.runtime.MessageSender) {
  const tab = sender?.tab
  if (tab?.url) return tab.url
  if (!tab?.id) return null

  return (await chrome.tabs.get(tab.id).catch(() => null))?.url || null
}

function canRunAction(senderUrl: string | null): boolean {
  if (!senderUrl) return false

  try {
    return isRecurbateHost(new URL(senderUrl).hostname)
  } catch {
    return false
  }
}

const handler: PlasmoMessaging.MessageHandler<
  RecurbateActionRequest,
  RecurbateActionResponse
> = async (req, res) => {
  const requestId = req.body?.requestId
  const signal = registerRequest(requestId)

  try {
    const { action, payload } = req.body || {}
    const runAction = action ? recurbateActions[action] : null

    if (!runAction) {
      const error = action
        ? `Unknown Recurbate action: ${action}`
        : "Missing Recurbate action"

      res.send({
        success: false,
        error
      })
      return
    }

    const senderUrl = await getSenderUrl(req.sender)
    if (!canRunAction(senderUrl)) {
      res.send({ success: false, error: "Recurbate action denied" })
      return
    }

    res.send({
      success: true,
      data: await runAction(payload, {
        senderTabId: req.sender.tab?.id,
        senderUrl,
        signal
      })
    })
  } catch (error) {
    res.send({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    })
  } finally {
    unregisterRequest(requestId)
  }
}

export default handler
