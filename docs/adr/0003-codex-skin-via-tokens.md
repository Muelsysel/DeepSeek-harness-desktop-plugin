# 0003 — Codex look via design-token overrides

The Codex skin is a stylesheet re-targeting the UI's `--dsw-*` alias tokens under `body[data-ds-dark-theme]`, injected with `webContents.insertCSS`. The UI themes itself through those tokens, so overriding them restyles the whole surface without forking or patching the frontend.

## Considered Options

- **Fork/restyle the frontend bundle**: owns the whole UI — heavy, breaks on every dsh update.
- **Hashed-class CSS hacks**: the bundle uses CSS modules (`_root_4qrvp_1`); brittle against every rebuild.

## Consequences

The skin can only reach surfaces the tokens drive. Surfaces the UI hard-codes are left as-is. The skin is off by default (`theme: default`) and can be disabled per window.
