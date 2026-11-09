"""Génère les PNG d'icônes depuis les SVG (Playwright + Chromium)."""
from pathlib import Path
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parent.parent / "public" / "icons"
jobs = [("icon.svg", "icon-192.png", 192), ("icon.svg", "icon-512.png", 512), ("icon-maskable.svg", "icon-maskable-512.png", 512)]
with sync_playwright() as p:
    b = p.chromium.launch()
    for src, out, size in jobs:
        page = b.new_page(viewport={"width": size, "height": size})
        svg = (root / src).read_text().replace("<svg ", f'<svg width="{size}" height="{size}" ', 1)
        page.set_content(f'<body style="margin:0;background:transparent">{svg}</body>')
        page.screenshot(path=str(root / out), omit_background=True)
        page.close()
    b.close()
