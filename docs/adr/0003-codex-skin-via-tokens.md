# 0003 — Codex look via design-token overrides

The Codex skin is a stylesheet re-targeting the UI's `--dsw-*` alias tokens under `body[data-ds-dark-theme]`, delivered as a `<style>` element appended by `executeJavaScript` (re-applied on every committed navigation). The UI themes itself through those tokens, so overriding them restyles the whole surface without forking or patching the frontend.

## Considered Options

- **Fork/restyle the frontend bundle**: owns the whole UI — heavy, breaks on every dsh update.
- **`webContents.insertCSS`**: the initial implementation; the injected CSS never survived the boot race in practice (the window can land on an error/404 document first), so the shell switched to a `<style>` tag re-applied on `did-navigate`/`did-finish-load`, which binds to whichever document is current at each event.

## Consequences

The skin can only reach surfaces the tokens drive. Surfaces the UI hard-codes are left as-is. The skin is off by default (`theme: default`) and can be disabled per window.
