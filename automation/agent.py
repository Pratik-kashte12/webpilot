import json
import sys
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

BASE_URL = "https://en.wikipedia.org/wiki/"

def log(message):
    print(json.dumps({"type": "log", "message": message}), flush=True)

def extract_summary(page):
    selectors = [
        "div.mw-content-ltr > p",
        "div.mw-parser-output > p",
        "main p",
        "p",
    ]

    for selector in selectors:
        paragraphs = page.locator(selector)

        for index in range(min(paragraphs.count(), 10)):
            text = paragraphs.nth(index).inner_text().strip()

            if len(text) > 80:
                return text

    return ""

def run_task(topic):
    log(f"Starting task for topic: {topic}")

    with sync_playwright() as playwright:
        log("Launching Chromium browser")

        browser = playwright.chromium.launch(headless=False)

        try:
            log("Creating browser page")

            page = browser.new_page()

            url = BASE_URL + topic.replace(" ", "_")

            log(f"Navigating to: {url}")

            page.goto(url, wait_until="domcontentloaded", timeout=45000)

            log("Checking page title")

            title = page.title().strip()

            if "Wikipedia" not in title:
                raise ValueError(f"Wikipedia page not found for topic: {topic}")

            log("Extracting page summary")

            summary = extract_summary(page)

            if not summary:
                raise ValueError("No readable summary was found on the Wikipedia page.")

            log("Task completed successfully")

            return {
                "title": title,
                "url": page.url,
                "summary": summary,
            }
        finally:
            log("Closing browser")

            browser.close()

def main():
    if len(sys.argv) < 2:
        print(json.dumps({
            "type": "error",
            "message": "Missing topic argument.",
        }), flush=True)
        sys.exit(1)

    topic = sys.argv[1].strip()

    try:
        result = run_task(topic)

        print(json.dumps({
            "type": "result",
            "result": result,
        }), flush=True)
    except PlaywrightTimeoutError as error:
        print(json.dumps({
            "type": "error",
            "message": f"Browser operation timed out: {error}",
        }), flush=True)
        sys.exit(1)
    except Exception as error:
        print(json.dumps({
            "type": "error",
            "message": str(error),
        }), flush=True)
        sys.exit(1)

if __name__ == "__main__":
    main()