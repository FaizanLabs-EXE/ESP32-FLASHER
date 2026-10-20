# Faizan Flash Forge

A polished, static GitHub Pages-ready ESP32 firmware flasher built around Espressif's `esptool-js` and the browser Web Serial API.

## Files

This flat package contains exactly seven files: `index.html`, `styles.css`, `app.js`, `github.js`, `flasher.js`, `manifest.webmanifest`, and `README.md`.

## Deploy

1. Create a public GitHub repository.
2. Upload all seven files to the repository root.
3. In **Settings → Pages**, deploy from the `main` branch root.
4. Open the HTTPS GitHub Pages URL in a compatible Chromium browser.

For local testing, do not double-click `index.html`. Serve the directory on localhost, for example with `python -m http.server 8080`, then open `http://localhost:8080`.

## Firmware sources

- Local `.bin` files, including multi-image builds.
- GitHub repository URLs.
- GitHub release or release-tag URLs.
- Direct GitHub release asset URLs.

The resolver checks matching release assets first, then scans the default branch for `.bin` files. Public GitHub API rate limits and repository CORS rules still apply.

## Important safety notes

- Browser hardware access always requires a user gesture and a device-selection prompt.
- HTTPS or localhost is required.
- Suggested flash offsets are filename-based. Verify them against the firmware project's partition/build output.
- A single merged factory image is commonly written at the address specified by its project. The default shown by this UI is not a universal guarantee.
- No software can promise zero errors across unknown firmware, cables, USB bridges, drivers, browser builds, partitions, and ESP chip variants.
- Android OTG support depends on the browser/device exposing a compatible serial interface. If Web Serial is unavailable, this static build will explain the limitation instead of pretending a flash can proceed.

## Recommended release convention

For reliable automatic discovery, publish `.bin` assets in GitHub Releases and include addresses in filenames when possible, for example:

- `bootloader-0x1000.bin`
- `partitions-0x8000.bin`
- `boot_app0-0xe000.bin`
- `firmware-0x10000.bin`

## Signature

⟦ 𝐁𝐔𝐈𝐋𝐓 𝐁𝐘 𝐅𝐀𝐈𝐙𝐀𝐍 ⟧
