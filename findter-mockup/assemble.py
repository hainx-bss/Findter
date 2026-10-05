#!/usr/bin/env python3
"""Split the Findter snapshot into folders, then rebuild the pages.

  python3 assemble.py --split /path/to/Findter.html
  python3 assemble.py

Edit the section and component files, then run assemble.py again.
app/home.html keeps styles inline because the app iframe is sandboxed.
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent

APP_PARTS = [
    "shell.html",
    "sections/welcome-header.html",
    "sections/onboarding/card.html",
    "sections/onboarding/activate-app-embed.html",
    "sections/onboarding/activate-search-suggestion.html",
    "sections/onboarding/custom-filters.html",
    "sections/onboarding/basic-search.html",
    "sections/data-insight.html",
    "sections/sidebar/app-status.html",
    "sections/sidebar/help-and-support.html",
    "sections/sidebar/sync-updates.html",
]

APP_STYLES = [
    "inter.css",
    "findter.css",
    "polaris-tokens.css",
    "crisp.css",
    "snapshot.css",
]

ADMIN_STYLES = [
    "single-file.css",
    "page-fade.css",
    "shopify-inter.css",
    "nav.css",
    "lumo.css",
    "admin-ui.css",
    "snapshot.css",
]

IFRAME = (
    '<iframe class=_WebFrame_1d40l_11 '
    'allow="clipboard-read; clipboard-write; local-network-access;" '
    'name=app-iframe title="Findter Filter &amp; Search" context=main '
    'src="app/home.html" '
    'style="position:relative;border-width:medium;border-style:none;'
    'border-color:currentcolor;border-image:none;width:100%;flex:1 1 0%;display:flex" '
    'sandbox="allow-scripts allow-popups allow-top-navigation-by-user-activation allow-same-origin"></iframe>'
)


def style_blocks(html: str, limit: int | None = None) -> list[tuple[int, int, str]]:
    blocks = []
    idx = 0
    end_limit = len(html) if limit is None else limit
    while True:
        start = html.find("<style", idx)
        if start < 0 or start >= end_limit:
            break
        open_end = html.find(">", start)
        close = html.find("</style>", open_end)
        if close < 0:
            break
        close += len("</style>")
        blocks.append((start, close, html[open_end + 1 : close - len("</style>")]))
        idx = close
    return blocks


def remove_blocks(html: str, blocks: list[tuple[int, int, str]]) -> str:
    for start, close, _inner in reversed(blocks):
        html = html[:start] + html[close:]
    return html


def pretty(html: str) -> str:
    out: list[str] = []
    i = 0
    n = len(html)
    while i < n:
        if html.startswith("<style", i) or html.startswith("<script", i):
            end_tag = "</style>" if html.startswith("<style", i) else "</script>"
            j = html.find(end_tag, i)
            if j < 0:
                out.append(html[i:])
                break
            j += len(end_tag)
            if out and not out[-1].endswith("\n"):
                out.append("\n")
            out.append(html[i:j])
            out.append("\n")
            i = j
            continue
        if html[i] == "<":
            if out and not out[-1].endswith("\n"):
                out.append("\n")
            j = i + 1
            quote = ""
            while j < n:
                char = html[j]
                if quote:
                    if char == quote:
                        quote = ""
                elif char in "\"'":
                    quote = char
                elif char == ">":
                    j += 1
                    break
                j += 1
            out.append(html[i:j])
            i = j
            continue
        j = html.find("<", i)
        if j < 0:
            j = n
        text = html[i:j].strip()
        if text:
            out.append(text)
        i = j
    return "".join(out).strip() + "\n"


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def inner_script(html: str, start: int) -> tuple[str, int]:
    open_at = html.find("<script", start)
    open_end = html.find(">", open_at)
    close = html.find("</script>", open_end)
    return html[open_end + 1 : close].strip() + "\n", close + len("</script>")


def inner_style(html: str, start: int) -> tuple[str, int]:
    open_at = html.find("<style", start)
    open_end = html.find(">", open_at)
    close = html.find("</style>", open_end)
    return html[open_end + 1 : close].strip() + "\n", close + len("</style>")


def split(monolith: str) -> None:
    head_close = monolith.find("</head>")
    if head_close < 0:
        raise SystemExit("Parent </head> not found")
    head_close += len("</head>")
    head = monolith[:head_close]
    rest = monolith[head_close:]

    parent_styles = style_blocks(head)
    if len(parent_styles) < 10:
        raise SystemExit(f"Expected parent styles, found {len(parent_styles)}")
    grouped = {
        "single-file.css": parent_styles[0][2],
        "page-fade.css": parent_styles[1][2],
        "shopify-inter.css": parent_styles[2][2],
        "nav.css": parent_styles[3][2],
        "lumo.css": "\n".join(block[2] for block in parent_styles[4:10]),
        "admin-ui.css": "\n".join(block[2] for block in parent_styles[10:-1]),
        "snapshot.css": parent_styles[-1][2],
    }
    for name, css in grouped.items():
        write(ROOT / "admin" / "styles" / name, css.strip() + "\n")

    head = remove_blocks(head, parent_styles)
    links = "\n".join(
        f'<link rel=stylesheet href="admin/styles/{name}">' for name in ADMIN_STYLES
    )
    links += (
        '\n<link rel=stylesheet href="components/welcome-banner/welcome.css">'
        '\n<link rel=stylesheet href="components/highlight-features/highlight.css">'
        '\n<link rel=stylesheet href="components/mockup-cases/mockup-cases.css">'
    )
    head = head.replace(
        "style-src 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline'",
        1,
    ).replace(
        "script-src 'unsafe-inline'",
        "script-src 'self' 'unsafe-inline'",
        1,
    )
    head = head.replace("</head>", links + "\n</head>", 1)
    write(ROOT / "admin" / "document-head.html", head)

    iframe_at = rest.find("<iframe class=_WebFrame")
    iframe_end = rest.find("</iframe>", iframe_at)
    if iframe_at < 0 or iframe_end < 0:
        raise SystemExit("App iframe not found")
    iframe_end += len("</iframe>")
    welcome_at = rest.find("<div id=fdt-welcome")
    highlight_at = rest.find("<div id=fdt-hf")
    if welcome_at < 0 or highlight_at < 0:
        raise SystemExit("Welcome or highlight markup not found")

    write(ROOT / "admin" / "chrome" / "before-frame.html", pretty(rest[:iframe_at]))
    write(
        ROOT / "admin" / "chrome" / "after-frame.html",
        pretty(rest[iframe_end:welcome_at]),
    )

    welcome_style, welcome_style_end = inner_style(rest, welcome_at)
    welcome_script, _welcome_script_end = inner_script(rest, welcome_style_end)
    welcome_html = rest[welcome_at : rest.find("<style", welcome_at)]
    write(ROOT / "components" / "welcome-banner" / "welcome.html", pretty(welcome_html))
    write(ROOT / "components" / "welcome-banner" / "welcome.css", welcome_style)
    write(ROOT / "components" / "welcome-banner" / "welcome.js", welcome_script)

    highlight_style_at = rest.find("<style", highlight_at)
    highlight_style, highlight_style_end = inner_style(rest, highlight_at)
    highlight_script, _highlight_script_end = inner_script(rest, highlight_style_end)
    write(
        ROOT / "components" / "highlight-features" / "highlight.html",
        pretty(rest[highlight_at:highlight_style_at]),
    )
    write(ROOT / "components" / "highlight-features" / "highlight.css", highlight_style)
    write(ROOT / "components" / "highlight-features" / "highlight.js", highlight_script)

    import html as html_lib

    srcdoc_at = monolith.find('srcdoc="')
    srcdoc_open = srcdoc_at + len('srcdoc="')
    srcdoc_close = monolith.find('"', srcdoc_open)
    app = html_lib.unescape(monolith[srcdoc_open:srcdoc_close])
    app_head_close = app.find("</head>")
    if app_head_close < 0:
        raise SystemExit("App </head> not found")
    app_styles = style_blocks(app, app_head_close)
    if len(app_styles) < 6:
        raise SystemExit(f"Expected app head styles, found {len(app_styles)}")
    app_grouped = {
        "inter.css": app_styles[0][2],
        "findter.css": app_styles[1][2] + "\n" + app_styles[2][2],
        "polaris-tokens.css": app_styles[3][2],
        "crisp.css": app_styles[4][2],
        "snapshot.css": app_styles[5][2],
    }
    for name, css in app_grouped.items():
        write(ROOT / "app" / "styles" / name, css.strip() + "\n")
    app = remove_blocks(app, app_styles[:6])
    app = app.replace("</head>", "<!--APP_STYLES-->\n</head>", 1)

    welcome = app.find("<div class=ft-welcome>")
    layout = app.find("<div class=Polaris-Layout>", welcome)
    guides = []
    scan = layout
    while True:
        found = app.find("<div class=grid-guide", scan)
        if found < 0:
            break
        guides.append(found)
        scan = found + 1
    data = app.find(
        '<div class=Polaris-Layout__Section><div class=Polaris-ShadowBevel',
        guides[-1],
    )
    aside = app.find(
        '<div class="Polaris-Layout__Section Polaris-Layout__Section--oneThird"',
        data,
    )
    status_bevels = []
    scan = aside
    while True:
        found = app.find("<div class=Polaris-ShadowBevel", scan)
        if found < 0:
            break
        status_bevels.append(found)
        scan = found + 1
    if len(guides) != 4 or data < 0 or aside < 0 or len(status_bevels) < 3:
        raise SystemExit(
            f"Unexpected app cuts guides={len(guides)} data={data} aside={aside} bevels={len(status_bevels)}"
        )
    help_at = status_bevels[1]
    sync_at = status_bevels[2]

    parts = {
        "shell.html": app[:welcome],
        "sections/welcome-header.html": app[welcome:layout],
        "sections/onboarding/card.html": app[layout:guides[0]],
        "sections/onboarding/activate-app-embed.html": app[guides[0] : guides[1]],
        "sections/onboarding/activate-search-suggestion.html": app[guides[1] : guides[2]],
        "sections/onboarding/custom-filters.html": app[guides[2] : guides[3]],
        "sections/onboarding/basic-search.html": app[guides[3] : data],
        "sections/data-insight.html": app[data:aside],
        "sections/sidebar/app-status.html": app[aside:help_at],
        "sections/sidebar/help-and-support.html": app[help_at:sync_at],
        "sections/sidebar/sync-updates.html": app[sync_at:],
    }
    labels = {
        "shell.html": "App document shell",
        "sections/welcome-header.html": "Welcome to Findter",
        "sections/onboarding/card.html": "Onboarding guide",
        "sections/onboarding/activate-app-embed.html": "Onboarding — Activate app embed in theme",
        "sections/onboarding/activate-search-suggestion.html": "Onboarding — Activate search suggestion",
        "sections/onboarding/custom-filters.html": "Onboarding — Set up custom filters",
        "sections/onboarding/basic-search.html": "Onboarding — Basic search engine and theme modal",
        "sections/data-insight.html": "Data insight",
        "sections/sidebar/app-status.html": "Findter app status",
        "sections/sidebar/help-and-support.html": "Help and support",
        "sections/sidebar/sync-updates.html": "Sync recent updates",
    }
    for name, chunk in parts.items():
        comment = f"<!-- {labels[name]} -->\n"
        write(ROOT / "app" / name, comment + pretty(chunk))


def build() -> None:
    head = (ROOT / "admin" / "document-head.html").read_text(encoding="utf-8")
    before = (ROOT / "admin" / "chrome" / "before-frame.html").read_text(encoding="utf-8")
    after = (ROOT / "admin" / "chrome" / "after-frame.html").read_text(encoding="utf-8")
    welcome = (ROOT / "components" / "welcome-banner" / "welcome.html").read_text(encoding="utf-8")
    highlight = (ROOT / "components" / "highlight-features" / "highlight.html").read_text(encoding="utf-8")
    index = (
        head
        + "\n"
        + before
        + IFRAME
        + "\n"
        + after
        + welcome
        + highlight
        + '<script src="components/welcome-banner/welcome.js?v=2"></script>\n'
        + '<script src="components/highlight-features/highlight.js?v=2"></script>\n'
        + '<script src="components/mockup-cases/mockup-cases.js?v=3"></script>\n'
        + "</body></html>\n"
    )
    write(ROOT / "index.html", index)

    styles = []
    for name in APP_STYLES:
        css = (ROOT / "app" / "styles" / name).read_text(encoding="utf-8")
        styles.append("<style>\n" + css.strip() + "\n</style>")
    chunks = []
    for name in APP_PARTS:
        chunks.append((ROOT / "app" / name).read_text(encoding="utf-8"))
    theme = (ROOT / "components" / "theme-compatibility" / "theme.html").read_text(encoding="utf-8")
    home = "\n".join(chunks).replace("<!--APP_STYLES-->", "\n".join(styles), 1)
    home = (
        home.rstrip()
        + "\n"
        + theme
        + '\n<script src="../components/theme-compatibility/theme.js?v=4"></script>\n'
    )
    write(ROOT / "app" / "home.html", home)

    write(
        ROOT / "Findter.html",
        """<!DOCTYPE html>
<html lang=en>
<head>
<meta charset=utf-8>
<title>Findter</title>
<script>location.replace("index.html" + location.search + location.hash)</script>
</head>
<body>
<p><a href="index.html">Open the Findter mockup</a></p>
</body>
</html>
""",
    )


def main() -> None:
    if "--split" in sys.argv:
        source = Path(sys.argv[sys.argv.index("--split") + 1])
        split(source.read_text(encoding="utf-8"))
    build()
    print("built", ROOT / "index.html")


if __name__ == "__main__":
    main()
