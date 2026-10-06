# Theme Editor (Apps)

Frozen SingleFile snapshot of Shopify Admin Theme Editor with `context=apps` — the screen merchants see when enabling a Findter app embed.

- **Open (compatible):** [`index.html`](index.html)
- **Open (incompatible):** [`index.html?themeIssue=1`](index.html?themeIssue=1)
- **Behavior:** [`theme-editor.js`](theme-editor.js) runs inside the Online Store `iframe` (SingleFile srcdoc). LOG-01 AF5–AF10 mock:
  - `?themeIssue=1` — one selector list (`.collection__wrapper`, `.main-collection`, filter `:has(...)` section) + Use for Filter / Search + Contact us
  - `?themeIssue=1&detect=empty` — AF6 empty state + Contact us
  - `?themeIssue=1&detect=fail` — AF7 wrong-selector path
  - Clear embed selector fields → use **Reset Fix it yourself** (mockup cases) then open the flow again
  - Expand **Search & filter core** for Collection grid / Search result / Custom CSS fields

- **Saved from:** `https://admin.shopify.com/store/…/themes/…/editor?context=apps&previewPath=%2Fcollections%2Fautomated-collection`
- **Saved date:** 2026-10-06

This is a full Admin surface (not App Home). Do not run it through `assemble.py`. Prefer editing `theme-editor.js` over the snapshot HTML.

**Return to Homepage:** in the Compatibility modal use **Go back home**, or the floating **Go back home** control (bottom-left) → `../../index.html`.
