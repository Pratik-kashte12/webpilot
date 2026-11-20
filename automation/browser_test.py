from pathlib import Path
from playwright.sync_api import sync_playwright

screenshot_path = Path(__file__).parent / "browser-test.png"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=False)
    page = browser.new_page()

    try:
        print("Opening Wikipedia...")

        page.goto(
            "https://en.wikipedia.org/wiki/India",
            wait_until="domcontentloaded",
            timeout=60000,
        )

        print("Page title:", page.title())

        page.screenshot(path=str(screenshot_path))
        print("Screenshot saved:", screenshot_path.name)

        page.wait_for_timeout(5000)
    finally:
        browser.close()