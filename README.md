# ClipForge Studio

A rights-safe short-form video studio for creators who need to turn owned or licensed footage into safe, publishable 9:16 videos.

## Features

- Email sign up and sign in
- Session management and sign-out-everywhere
- CSRF token checks and CSP headers
- Rights-safe project creation and approval gates
- Upload metadata and timeline planning
- 9:16 reframe workflow
- Free-form caption, audio and watermark handles
- FFmpeg render workflow
- Scheduler, review states and publishing status
- Mock platform integrations for YouTube, TikTok, Instagram
- Reference Lab and Reality generator modes
- Local-only storage for prototype testing on localhost

## Requirements

- Node.js 22.5 or newer
- FFmpeg installed and available in PATH

## Quick start

```bash
node --no-warnings server.js
```

Then open:

- http://localhost:3000 for the marketing page
- http://localhost:3000/app for the studio

## Run API tests

```bash
npm test
```

## UI smoke test

```bash
python3 test/ui.py
```

This uses Playwright if installed; otherwise it falls back to URL checks.

## Notes

- Local persistence uses JSON files under `data/`.
- OAuth and real platform publishing require credentials, which are intentionally stubbed for local-only use until you add real keys.
- Auto-publish remains off by default, matching the rights-safe workflow.
