# Video Thumbnails Previewer

Open-source browser extension for previewing video thumbnails on supported websites.

## Development

```sh
pnpm install
pnpm dev
pnpm test
pnpm build
```

## AI agent instructions

This repository keeps shared coding-agent instructions in `AGENTS.md`.

Some coding agents, including Codex, can read `AGENTS.md` directly. If your coding agent does not automatically load it, copy or import the contents of `AGENTS.md` into that agent's project instruction system before making changes.

Agents should read `docs/codemap.md` before editing code and update it whenever architecture, provider contracts, permissions, runtime flow, background capabilities, or build/test contracts change.

## Adding a provider

- Add the provider under `providers/` and register it in `providers/registry.ts`.
- Use `provider.matches` as the host-level gate and `getPageKey()` as the video-page gate.
- Add narrow content script matches in `content.tsx` for video pages and feature-only pages that need injected UI.
- Add only the host permissions needed for page access, image fetches, or scripting.
- Keep provider-specific background actions in the provider folder, grouped by provider id and narrow sender URL matches, then register them in `background/messages/provider-action.ts`.
- Verify preview loading, seek behavior, popup mode, embedded mode, and optional feature buttons.
