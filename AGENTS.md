# AGENTS.md

## Project Intent

- Recurbate Thumbnails Previewer is a free, open-source Plasmo MV3 browser extension.
- The extension supports Recurbate pages on `recu.me` and `recu.club`.
- Keep the project local-first, permission-light, and focused on previewing Recurbate timeline thumbnails.
- Discuss product scope changes before adding hosted services, account-based flows, or support for another website.

## Read First

- Read `docs/codemap.md` before changing code.
- Read every call site of the code you plan to edit before changing it.
- For Recurbate page behavior, start with `recurbate/index.ts`, `recurbate/features.ts`, and `recurbate/background.ts`.

## Design Principles

- Implement the simplest working version first.
- Keep patches small and scoped to the requested behavior.
- Avoid broad refactors, compatibility layers, speculative abstractions, and incidental cleanup.
- Keep Recurbate-specific DOM, timeline, player, Open All, Save Range, and Save All behavior inside `recurbate/`.
- Keep shared lifecycle, storage, background messaging, image processing, and rendering behavior in runtime or content-level code.
- Prefer explicit declarations over build magic. Content-script matches and host permissions should remain easy to review in pull requests.
- Do not introduce broad permissions such as `<all_urls>`, `http://*/*`, `https://*/*`, `tabs`, or `cookies` unless the product requirement explicitly changes.

## Recurbate Rules

- `recurbate/url.ts` owns supported host and page-key detection.
- `recurbate/index.ts` owns video-page preview loading and thumbnail seek behavior.
- `recurbate/features.ts` owns performer-page Open All, Save Range, and Save All buttons.
- `recurbate/background.ts` owns main-world player actions that need page JavaScript context.
- Keep special Recurbate behavior isolated. Examples include custom DOM waits, timeline stripe detection, HLS stream resume, and performer-page batch actions.

## Testing Rules

- Run `pnpm test` after behavior changes.
- Run `pnpm build` after manifest, content-script, permission, or Plasmo entry changes.
- Run `pnpm verify` before publishing a release or push.
- Add focused unit coverage for URL detection, content-script match coverage, storage defaults, background message guards, and manifest permissions when those areas change.

## Codemap Rule

- `docs/codemap.md` is the latest architecture snapshot.
- Update it in the same change when system boundaries, runtime flow, permissions, background capabilities, build commands, or test contracts change.
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
