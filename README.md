# Findter

Static Shopify-admin mockups for the Findter Filter & Search app.

## Mockup

Source lives in `findter-mockup/`. Open `findter-mockup/index.html` locally, or use the published GitHub Pages site after deploy.

## GitHub Pages

Auto-deploy runs from `.github/workflows/deploy-pages.yml`:

- **Push / merge to `main`:** builds and deploys `findter-mockup/` to GitHub Pages.
- **Pull request to `main`:** builds the artifact only (no publish).
- **Manual:** Actions → Deploy Pages → Run workflow.

Enable once: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

Site URL (after first successful deploy): https://hainx-bss.github.io/Findter/

## Cursor / Polaris

Project rules live in `.cursor/rules/` (see `AGENTS.md`). App UI should use Polaris web components (`s-*`).
