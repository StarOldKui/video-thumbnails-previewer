# Codemap

## Maintenance Rule

- This codemap is the latest architecture snapshot for this project.
- Update it when system boundaries, provider contracts, runtime state, permissions, build outputs, or background capabilities change.
- Keep migration history, changelogs, and design debates out of this file.
- Prefer verified facts from source code, package metadata, generated manifests, and official platform docs.

## Product Boundary

- Product name: Video Thumbnails Previewer.
- Project path: `/Users/alen/Shrimpfall-Goose/Code/video-thumbnails-previewer-v2`.
- This directory is the Plasmo MV3 browser extension root.
- The project boundary is content-script UI, provider integrations, popup settings, local extension state, and background extension capabilities.
- Hosted services and account-based product flows are outside the current extension boundary.
- Adjacent reference path: `/Users/alen/Shrimpfall-Goose/Code/video-thumbnails-previewer` is outside this project boundary.
- The directory is initialized as a git repository.

## Runtime Sources Of Truth

- Extension metadata and manifest inputs: `package.json`.
- Coding-agent project instructions: `AGENTS.md`.
- Content script entry: `content.tsx`.
- Popup entry: `popup.tsx`.
- Provider registry: `providers/registry.ts`.
- Provider contract: `providers/types.ts`.
- Local state contract: `runtime/storage.ts`.
- Content-to-background client wrappers: `runtime/background-client.ts`.
- Background message handlers: `background/messages/*.ts`.
- Preview rendering: `components/PreviewPanel.tsx` and `style.css`.
- Unit tests: `tests/unit/*.test.ts`.
- Vitest config: `vitest.config.mts`.
- Generated runtime manifest: `build/chrome-mv3-prod/manifest.json`.

## Provider Model

- Providers are imported explicitly in `providers/registry.ts`.
- `findProvider(url)` selects a provider by `provider.matches` and then `provider.getPageKey(url)`.
- `findHostProvider(url)` selects a host-level provider by `provider.matches`.
- Required provider fields are `id`, `matches`, `getPageKey`, and `loadPreview`.
- Optional provider fields are `label`, `autoOpenScope`, `defaults`, `mount`, and `features`.
- Provider settings storage keys are derived from `id` by `runtime/storage.ts`: `vtp:${providerId}:settings`.
- Preview visibility is tab-local React state in `content.tsx`; it is not persisted in extension storage.
- Global settings defaults are `displayMode: "popup"` and `autoOpen: false`.
- Provider defaults override global defaults through `getProviderDefaults(provider)`.

## Provider Inventory

- `providers/youtube/index.ts`: YouTube watch pages, storyboard metadata, direct sprite preview rendering, stale SPA data recovery from current watch data, and player seeking.
- `providers/twitch/index.ts`: Twitch VOD pages, GQL preview metadata, sprite image fetching, embedded default mode, and player seeking.
- `providers/recurbate/index.ts`: Recurbate video pages, timeline stripe detection, embedded default mode, and video seeking.
- `providers/recurbate/features.ts`: Recurbate performer-page Open All, Save Range, and Save All actions.
- `providers/missav/index.ts`: MissAV video pages, main-world thumbnail config extraction, raw sprite rendering, cold-start playback, and player seeking.
- `providers/pornhub/index.ts`: PornHub video pages, main-world sprite metadata extraction, sprite processing, and player seeking.
- `providers/pornhub/features.ts`: PornHub model-page Open All action.
- `providers/pimpbunny/index.ts`: PimpBunny video pages, DOM video id extraction, background thumbnail URL probing, and player seeking.

## Content Runtime Flow

- Plasmo injects the single content UI from `content.tsx` into `document.body`.
- The Plasmo shadow host id is `vtp-root` for deterministic runtime inspection.
- `config.matches` statically limits injection to supported page families.
- YouTube and Twitch use host-level content-script matches so SPA navigation from non-video pages into video pages is covered.
- `useCurrentUrl()` tracks SPA URL changes through history events, `popstate`, and a polling fallback.
- The active page provider is recalculated from the URL and page key.
- `useSettings()` loads provider settings from `chrome.storage.local`.
- The current tab owns preview visibility, mode, and page key in local React state.
- Display-mode changes update an already visible preview without reloading provider preview data.
- Auto open runs on each video page by default. Providers with `autoOpenScope: "tab"` only auto-expand once per content app lifecycle, which is used for SPA-style providers.
- Popup-triggered preview opens are delivered to the active content script with `chrome.tabs.sendMessage`.
- Preview loading calls `provider.loadPreview(context)` and stores the latest loaded token to avoid redundant reloads for the same provider, page, and open event.
- If thumbnails were generated before the page video duration was available, `content.tsx` recovers generated timestamps once duration becomes available.
- Popup mode renders `PreviewPanel` as a fixed overlay through a `document.body` portal.
- Embedded mode renders `PreviewPanel` through a provider-defined portal mount when `provider.mount.embedded` exists.
- Preview buttons render through a provider-defined portal mount when `provider.mount.button` exists.
- Portal mounts own their DOM host, remove stale same-variant hosts and stale portal children, and reattach only when the original anchor is replaced or detached.
- Provider features mount when any matching host provider contains a feature whose `matches(url)` returns true.

## Popup Flow

- `popup.tsx` reads the active browser tab URL with `chrome.tabs.query`.
- The popup resolves site settings with `findHostProvider(url)`.
- The popup enables the shared preview action only when the host provider also returns a video `pageKey`.
- Settings are read and written through `getSettings(provider)` and `setSettings(provider, settings)`.
- Opening the preview sends a tab-scoped `vtp:open-preview` message to the active content script.
- The popup does not render provider-specific controls beyond shared display mode and auto-open settings.

## Background Capabilities

- `background/messages/fetch-images.ts` fetches image URLs, accepts image or binary-octet image responses, retries failures, and returns image data URLs.
- `background/messages/provider-action.ts` dispatches provider-owned background actions by `providerId` and action name after sender URL validation.
- Provider-owned background actions live in `providers/*/background.ts`.
- `background/messages/cancel-request.ts` aborts in-flight background requests by request id.
- `background/messages/open-tabs.ts` opens same-host batches of tabs sequentially and responds after all requested tabs are created.
- `background/messages/find-tab-resource.ts` opens a same-host background tab, waits with separate tab-ready and resource-scan budgets, scans resource timing entries for a resource pattern, and closes the tab.
- `background/request-registry.ts` owns shared abort controllers for cancelable background requests.
- Content code reaches these handlers only through `runtime/background-client.ts`.

## Permissions And Host Scope

- Manifest permissions are `activeTab`, `scripting`, and `storage`.
- Content-script matches are limited to the supported site page families.
- Host permissions are limited to supported page hosts and extension-fetched resource hosts in `package.json`.
- The generated manifest contains no `cookies`, `<all_urls>`, `http://*/*`, or `https://*/*` broad injection rule.

## Build And Artifacts

- Package manager: `pnpm@9.15.4`.
- Plasmo version: `plasmo@0.90.5`.
- Main scripts: `pnpm dev`, `pnpm test`, `pnpm build`, `pnpm package`, and `pnpm verify`.
- Unit test runner: Vitest with Node environment and a Plasmo `~` alias in `vitest.config.mts`.
- Current unit coverage focuses on provider matching, provider page keys, storage defaults, request cancellation, background client messages, provider action isolation, generated timestamp recovery, raw sprite preview mapping, PimpBunny thumbnail count probing, same-host tab/resource guards, find-tab-resource timeout caps, and manifest policy.
- Build output directory: `build/`.
- Packaged Chrome MV3 zip: `build/chrome-mv3-prod.zip`.
- Generated Plasmo cache directory: `.plasmo/`.
- Generated artifacts and dependency folders are ignored by `.gitignore`.

## Environment Contract

- Source code does not require environment variables.
- Source code has no server-only secrets or remote persistence contracts.

## Child Codemaps

- No child codemaps exist.

## Read-First Files

- `AGENTS.md`
- `package.json`
- `content.tsx`
- `providers/types.ts`
- `providers/registry.ts`
- `runtime/storage.ts`
- `runtime/background-client.ts`
- `background/messages/provider-action.ts`
- `background/request-registry.ts`
- `providers/match-pattern.ts`
- `components/PreviewPanel.tsx`
- `vitest.config.mts`
- `tests/unit/`
