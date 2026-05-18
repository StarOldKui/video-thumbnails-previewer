export interface ProviderActionContext {
  senderTabId?: number
  senderUrl?: string
  signal?: AbortSignal
}

export type ProviderActionHandler = (
  payload: unknown,
  context: ProviderActionContext
) => Promise<unknown>

export type ProviderActionMap = Record<string, ProviderActionHandler>

export interface ProviderBackgroundActions {
  providerId: string
  matches: string[]
  actions: ProviderActionMap
}
