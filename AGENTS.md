# AGENTS.md

## Project Intent

- Video Thumbnails Previewer is a free, open-source Plasmo MV3 browser extension.
- The repository scope is the browser extension itself; discuss product scope changes before adding hosted services or account-based flows.
- Protect user trust with narrow permissions, predictable behavior, and no hidden remote dependencies.
- Keep the extension simple, local-first, and easy for contributors to extend.

## Read First

- Read `docs/codemap.md` before changing code.
- Read `providers/types.ts`, `providers/registry.ts`, and the closest existing provider before adding or changing provider logic.
- Read every call site of the code you plan to edit before changing it.

## Design Principles

- Implement the simplest working version first.
- Keep patches small and scoped to the requested behavior.
- Avoid broad refactors, compatibility layers, speculative abstractions, and incidental cleanup.
- Keep provider-specific behavior inside the provider folder.
- Keep shared lifecycle, storage, background messaging, image processing, and rendering behavior in runtime or content-level code.
- Prefer explicit declarations over build magic. Supported providers, content-script matches, and host permissions should remain easy to review in pull requests.
- Do not introduce broad permissions such as `<all_urls>`, `http://*/*`, `https://*/*`, `tabs`, or `cookies` unless the product requirement explicitly changes.

## Provider Rules

- A provider must implement `id`, `matches`, `getPageKey`, and `loadPreview`.
- Treat `matches` as the host-level gate and `getPageKey` as the video-page gate.
- Optional provider capabilities belong in `defaults`, `mount`, `features`, or provider-local background action files.
- Add the provider to `providers/registry.ts`.
- Add narrow content-script matches in `content.tsx` for video pages and feature-only pages that need injected UI.
- Add only the host permissions needed for page access, image fetches, or scripting.
- Provider background actions must define narrow sender URL matches.
- Keep special site behavior isolated. Examples include custom DOM waits, player offsets, non-linear timestamps, Open All, Save All, and main-world extraction.
- If timestamps are not evenly derivable from generated thumbnails, compute them in the provider instead of relying on runtime timestamp recovery.

## Testing Rules

- Run `pnpm test` after behavior changes.
- Run `pnpm build` after manifest, content-script, permission, or Plasmo entry changes.
- For a new provider, manually verify and add focused unit coverage for page key extraction, provider registry selection, content-script match coverage, and manifest permissions.
- If the provider uses background actions, test allowed and denied sender URLs.
- If a provider depends on late video duration, test timestamp recovery or provider-owned timestamp generation.

## Codemap Rule

- `docs/codemap.md` is the latest architecture snapshot.
- Update it in the same change when system boundaries, provider contracts, runtime flow, permissions, background capabilities, build commands, or test contracts change.
- Use a codemap-maintainer skill if the active agent supports it. Otherwise, update `docs/codemap.md` manually.
- Keep codemap text present-tense and factual. Do not turn it into a changelog, migration diary, or design debate.

## Documentation Rule

- `AGENTS.md` is the single coding-agent instruction source for this repository.
- Do not add separately maintained `CLAUDE.md`, `GEMINI.md`, or `.cursor/rules` files unless the maintainer explicitly asks for them.
- If an agent does not load `AGENTS.md` automatically, the contributor should copy or import this file into that agent's project instruction system.

## Code Style

- Use English for code, comments, identifiers, docs, tests, and commit messages.
- Put imports at the top of the file.
- Keep logic direct and readable.
- Avoid unnecessary defensive checks when the surrounding context already guarantees the input shape.
