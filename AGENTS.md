# Findter

Static Shopify-admin mockup for the Findter Filter & Search app.

## Where the mockup lives

- Open `findter-mockup/Findter.html`. It redirects to `findter-mockup/index.html`.
- App body parts: `findter-mockup/app/`. Admin chrome (global nav, top bar): `findter-mockup/admin/`.
- Rebuild the assembled pages with `python3 findter-mockup/assemble.py`.

## Polaris

Cursor loads `.cursor/rules/polaris-ui.mdc` on every turn (`alwaysApply: true`). Follow it for mockup and UI edits: public Polaris web components (`s-*`) for app content, and the existing HTML mock for the admin shell.
