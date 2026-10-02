# Fast-save design proposal

Designs for making the contact save as fast as possible. The owner approved them on 2 October 2026, and they are built into the app. [HANDOFF.md](../../HANDOFF.md) has the current status.

| File | Artboard |
|---|---|
| `Main.dc.html` | Option A: the QR code saves straight to Contacts (recommended for the wallpaper) |
| `FlowB.dc.html` | Option B: the QR code opens the card page first |
| `Card.dc.html` | The save-first card page. Its `state` tweak shows the "Almost done" message after Save. |
| `OwnerQR.dc.html` | The owner's QR code tab. Its `mode` tweak switches between A and B. |
| `OwnerWallpaper.dc.html` | The lock-screen wallpaper |
| `canvas.json` | Canvas layout: artboard positions, sizes, titles and section headings |

These are Claude Design canvas files (`.dc.html`). They need the canvas runtime (`support.js`) to render, so opening them directly in a browser won't work. To view or edit them, ask Claude to create a Design canvas and publish these files under its `project/` folder, with the same names and `canvas.json` as the index.

Bracketed text such as `[Your title]` marks details still to fill in. The QR codes in the artboards are illustrations and don't scan.
