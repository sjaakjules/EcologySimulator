# Repository Guidelines

## Project Structure & Module Organization
This repository currently holds the product definition in `PDR.md`, the implementation blueprint in `CodeBase.md`, the canonical content bundle in `large_old_eucalypt_content_layer_v4.json`, and supporting literature in `Data/`. Planned application work should follow the monorepo shape described in `CodeBase.md`: `web/` for the Next.js shell and `packages/` for shared modules such as `domain`, `schema`, `sim-core`, `scene3d`, `authoring`, `storage`, and `worker-runtime`.

## Build, Test, and Development Commands
Use `pnpm` for workspace tasks once the app scaffold lands. Expected commands are `pnpm install` to install workspace dependencies, `pnpm dev` to start the local app on `http://localhost:3000`, `pnpm build` for a production build, `pnpm test` for automated checks, and `pnpm lint` for static analysis. Keep command names stable at the workspace root so editor tooling and CI can rely on them.

## Coding Style & Naming Conventions
Prefer TypeScript across `web/` and `packages/`. Use 2-space indentation, `camelCase` for variables and functions, `PascalCase` for React components and domain types, and kebab-case for package names and content files. Keep Three.js scene logic in dedicated scene/runtime modules rather than React component trees. Name JSON content bundles descriptively, for example `large_old_eucalypt_content_layer_v4.json`.

## Testing Guidelines
Focus tests on schema validation, deterministic simulation behavior, and fixture-backed content loading. Place schema fixtures beside `packages/schema`, simulation tests beside `packages/sim-core`, and UI smoke tests under the future `web/` app. Use test names that describe behavior, such as `loads_hero_tree_bundle` or `advances_daily_tick_deterministically`.

## Commit & Pull Request Guidelines
Use Conventional Commits such as `feat: add voxel schema validation` or `docs: refine panarchy terminology`. Pull requests should include a short summary, links to the relevant issue or spec section, screenshots for UI or scene changes, and explicit notes when JSON content, schema contracts, or source provenance change.

## Data & Content Notes
Treat `Data/` as reference material, not generated output. Preserve provenance fields, evidence tiers, and source citations when editing content bundles, and prefer additive schema evolution over silent field reuse.
