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

## Branch previews (Cloudflare Pages)

Cloudflare Pages is connected to this repo (no build command, output directory `findter-mockup`). Every push to a non-`main` branch gets its own preview URL, separate from GitHub Pages:

- `https://<branch-slug>.<project>.pages.dev/` — branch name lowercased, `/` and other symbols become `-` (e.g. `feat/highlight-feature` → `feat-highlight-feature`).
- Find the exact URL in Cloudflare → Workers & Pages → the project → **Deployments**, or in the Cloudflare comment on the PR.
- Add `?resetHighlight=1` to replay the Highlight Features welcome flow.

## Cursor / Polaris

Project rules live in `.cursor/rules/` (see `AGENTS.md`). App UI should use Polaris web components (`s-*`). App Home iframe loads Polaris 2.0 RC: `https://cdn.shopify.com/shopifycloud/polaris-2.0-rc.js` (see `findter-mockup/app/shell.html`). Rebuild with `python3 findter-mockup/assemble.py`.
