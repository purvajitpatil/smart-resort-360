"""
Capture fresh screenshots of every page in both apps.

- Guest app runs on http://localhost:5173 (no auth)
- Staff dashboard runs on http://localhost:5174 (login required)

Output: screenshots/N-*.png  (N is 1-based order)
"""
import sys
import io
# Force UTF-8 on Windows so the progress prints don't crash on cp1252.
try: sys.stdout.reconfigure(encoding="utf-8")
except Exception: pass
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT = Path(__file__).parent / "screenshots"
OUT.mkdir(exist_ok=True)

GUEST  = "http://localhost:5173"
STAFF  = "http://localhost:5174"

# 1-based: page order matches the demo flow.
SHOTS = [
    # ── Guest app (visitor-facing) ────────────────────────────────
    ("guest-login",         f"{GUEST}/login",                "guest", False),
    ("guest-home",          f"{GUEST}/",                     "guest", True),
    ("guest-assistant",     f"{GUEST}/assistant",            "guest", True),
    ("guest-requests",      f"{GUEST}/requests",             "guest", True),
    ("guest-preferences",   f"{GUEST}/preferences",          "guest", True),

    # ── Staff dashboard (ops-facing) ──────────────────────────────
    ("staff-login",         f"{STAFF}/login",                "staff", False),
    ("staff-dashboard",     f"{STAFF}/app",                  "staff", True),
    ("staff-requests",      f"{STAFF}/app/requests",         "staff", True),
    ("staff-rooms",         f"{STAFF}/app/rooms",            "staff", True),
    ("staff-escalations",   f"{STAFF}/app/escalations",      "staff", True),
    ("staff-inventory",     f"{STAFF}/app/inventory",        "staff", True),
    ("staff-revenue",       f"{STAFF}/app/revenue",          "staff", True),
    ("staff-pricing",       f"{STAFF}/app/pricing",          "staff", True),
    ("staff-schedule",      f"{STAFF}/app/schedule",         "staff", True),
    ("staff-segments",      f"{STAFF}/app/segments",         "staff", True),
    ("staff-sentiment",     f"{STAFF}/app/sentiment",        "staff", True),
    ("staff-memory",        f"{STAFF}/app/memory",           "staff", True),
]


def login_if_needed(page, app_kind: str) -> None:
    if app_kind != "staff":
        return
    # Inject tokens from localStorage by performing the login via fetch.
    page.goto(f"{STAFF}/login", wait_until="networkidle")
    page.evaluate("""
        async () => {
          const r = await fetch('/api/v1/auth/login', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
              email: 'manager@smartresort360.demo',
              password: 'DemoManager!2026',
            }),
          });
          const env = await r.json();
          if (env.success) {
            localStorage.setItem('smrt360_staff_access',  env.data.access_token);
            localStorage.setItem('smrt360_staff_refresh', env.data.refresh_token);
            localStorage.setItem('smrt360_staff_user',    JSON.stringify(env.data.user));
          } else {
            throw new Error('login failed: ' + JSON.stringify(env));
          }
        }
    """)


def shoot(page, name: str) -> Path:
    target = OUT / f"{name}.png"
    page.wait_for_load_state("networkidle", timeout=15000)
    # Give animations / lazy fetches a beat to settle.
    page.wait_for_timeout(900)
    page.screenshot(path=str(target), full_page=True)
    print(f"  [OK] {target.name}")
    return target


def main() -> int:
    failed = []
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        ctx = browser.new_context(
            viewport={"width": 1440, "height": 900},
            device_scale_factor=1.5,
        )

        for idx, (name, url, app_kind, needs_auth) in enumerate(SHOTS, start=1):
            page = ctx.new_page()
            try:
                if needs_auth and app_kind == "staff":
                    login_if_needed(page, app_kind)
                print(f"[{idx:>2}/{len(SHOTS)}] {name}  <-  {url}")
                page.goto(url, wait_until="domcontentloaded", timeout=20000)
                if name == "staff-memory":
                    # Click the "Load brief" button to render guest data
                    page.wait_for_timeout(800)
                    btn = page.locator("button:has-text('Load brief')")
                    if btn.count() > 0:
                        btn.first.click()
                        page.wait_for_timeout(1500)
                if name == "staff-pricing":
                    # Click "Run simulation" to show the AI recommendation panel
                    page.wait_for_timeout(800)
                    btn = page.locator("button:has-text('Run simulation')")
                    if btn.count() > 0:
                        btn.first.click()
                        page.wait_for_timeout(1200)
                if name == "staff-segments":
                    # Type a guest ID to show the per-guest drill-down
                    page.wait_for_timeout(800)
                    inp = page.locator("input[placeholder='e.g. 1']")
                    if inp.count() > 0:
                        inp.first.fill("1")
                        page.wait_for_timeout(1200)
                if name == "staff-schedule":
                    # Switch to the "Gaps" tab to show the analysis table
                    page.wait_for_timeout(800)
                    tab = page.locator("button:has-text('Gaps')")
                    if tab.count() > 0:
                        tab.first.click()
                        page.wait_for_timeout(800)
                if name == "guest-assistant":
                    # Type a sample question so the AI bubble is visible
                    page.wait_for_timeout(800)
                    inp = page.locator("input[type='text'], textarea").first
                    if inp.count() > 0:
                        try:
                            inp.fill("Where can I go for dinner tonight?")
                            inp.press("Enter")
                        except Exception:
                            pass
                        page.wait_for_timeout(1800)
                if name == "guest-requests":
                    # Open the new-request form if there's a button for it
                    page.wait_for_timeout(800)
                    btn = page.locator("button:has-text('New request'), button:has-text('Create')").first
                    if btn.count() > 0:
                        try:
                            btn.click()
                            page.wait_for_timeout(700)
                        except Exception:
                            pass
                if name == "guest-preferences":
                    # Toggle a few preferences so the chips show
                    page.wait_for_timeout(800)
                shoot(page, name)
            except Exception as e:
                print(f"  [FAIL] {name}: {e}")
                failed.append((name, str(e)))
            finally:
                page.close()

        browser.close()

    print()
    if failed:
        print(f"FAILED {len(failed)}:")
        for n, e in failed:
            print(f"  - {n}: {e}")
        return 1
    print(f"OK — {len(SHOTS)} screenshots in {OUT}/")
    return 0


if __name__ == "__main__":
    sys.exit(main())
