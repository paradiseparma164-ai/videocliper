from __future__ import annotations

import sys
from urllib.request import urlopen
from urllib.error import URLError


def main() -> int:
    url = 'http://localhost:3000/'
    try:
        with urlopen(url, timeout=10) as response:
            body = response.read().decode('utf-8', errors='replace')
            print(f'HTTP {response.status}: {response.geturl()}')
            print('Page title check:', 'ClipForge Studio' in body or 'rights-safe' in body.lower())

        app_url = 'http://localhost:3000/app'
        with urlopen(app_url, timeout=10) as response:
            app_page = response.read().decode('utf-8', errors='replace')
            print(f'HTTP {response.status}: {response.geturl()}')
            print('Studio shell check:', 'ClipForge Studio' in app_page or 'Sign in' in app_page)
        return 0
    except URLError as exc:
        print(f'UI smoke test failed: {exc}')
        try:
            import playwright
            print('Playwright is installed, but local server is not running.')
            print('Start the app with: node --no-warnings server.js')
        except Exception:
            print('Playwright is not installed. Install it with: pip install playwright')
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
