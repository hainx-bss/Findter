# Findter

Static Shopify-admin mockups for the Findter Filter & Search app.

## Mockup

Source lives in `findter-mockup/`. Open `findter-mockup/index.html` locally, or use the published GitHub Pages site after deploy.

| Entry | Path |
| --- | --- |
| Findter App Home | `findter-mockup/index.html` |
| Theme Editor (enable app embed) | `findter-mockup/screens/theme-editor/index.html` |

From App Home, use the overflow **Mockup cases** menu → **View Theme Editor**, or complete the theme flow and click **Enable App In Theme Editor**.

## GitHub Pages

Auto-deploy runs from `.github/workflows/deploy-pages.yml`:

- **Push / merge to `main`:** builds and deploys `findter-mockup/` to GitHub Pages.
- **Pull request to `main`:** builds the artifact only (no publish).
- **Manual:** Actions → Deploy Pages → Run workflow.

Enable once: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

Site URL (after first successful deploy): https://hainx-bss.github.io/Findter/

## Cursor / Polaris

Project rules live in `.cursor/rules/` (see `AGENTS.md`). App UI should use Polaris web components (`s-*`). App Home iframe loads Polaris 2.0 RC: `https://cdn.shopify.com/shopifycloud/polaris-2.0-rc.js` (see `findter-mockup/app/shell.html`). Rebuild with `python3 findter-mockup/assemble.py`.
