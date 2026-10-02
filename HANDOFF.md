# Handoff notes

Status as of 2 October 2026. Everything below is on the `claude/qr-card-app` branch.

## The goal

The person who scans the QR code must be able to save Savan's contact **as quickly and easily as possible**. This is the most important job of the app, so judge every design and code choice against it.

## Where things stand

| Area | State |
|---|---|
| App | v1 plus the approved fast-save redesign: Straight to Contacts is the default QR mode, the card page is save-first, the QR tab has the two option cards and "In your contact" switches, and the wallpaper has a name row and "Scan to save my contact". See [README.md](README.md). |
| Routing | The site root shows the published card. The editor is at `#/edit`. `#/card` still works for old links. |
| Tests | 22 unit tests (`npm test`) and 23 browser checks (see [Verify](#verify)) pass. |
| Hosting | DigitalOcean App Platform app `qr-scan` (id `d6123f88-f8c3-4356-af9e-d6236d8136d3`), spec in [`.do/app.yaml`](.do/app.yaml). Live at https://qr-scan-dwcyv.ondigitalocean.app. Pushes to `claude/qr-card-app` redeploy it. |
| Domain | `card.savankong.com` is in the spec. DNS for savankong.com is at **GoDaddy**. The owner still needs to add **CNAME `card` → `qr-scan-dwcyv.ondigitalocean.app`**. DigitalOcean then issues the certificate. |
| profile.json | Not published yet, so the root says "This card hasn't been published yet" and the "My card" link in the contact leads there. Publish it from the QR tab (Download profile.json → commit to `public/`). |

## Decisions made

1. Designs approved: Option A (vCard in the QR code) by default, Option B (card page) for shared links.
2. Visitors get the card at the root, and the editor moved to `#/edit`.
3. The DigitalOcean app was created on 2 October 2026.

## Next steps

- Check the camera prompts, the `.vcf` save in Safari, and the share sheet on a real iPhone and Android.
- The tap counts in the QR tab ("about 3 taps", "about 4 taps") are still estimates. Correct them after testing on real phones.
- A full profile with every switch on makes a dense 73×73 code ("Dense, may scan slowly"). Consider which details to switch off by default once real-phone scans are tested.
- When the work merges to `main`, change `branch` in `.do/app.yaml` and in the live app.

## The design (docs/design)

The approved artboards are in [docs/design/](docs/design/), and [docs/design/README.md](docs/design/README.md) explains how to open them. The original canvas is private to the previous account: https://claude.ai/artifact/7avqQoRMqxbCL1zGZaAmfZ

## Deploying to DigitalOcean

**Never commit an API token.** The previous session's token was pasted into chat and should be revoked (DigitalOcean → API → Tokens). Use a fresh token from an environment variable such as `DIGITALOCEAN_TOKEN`.

The app already exists. To recreate it elsewhere, use one of these:

- Dashboard: **Apps → Create App → GitHub → `savankong/QR-Scan`**, branch `claude/qr-card-app`, static site, build command `npm run build`, output directory `dist`.
- doctl: `doctl apps create --spec .do/app.yaml`
- API: `POST https://api.digitalocean.com/v2/apps` with body `{"spec": <.do/app.yaml as JSON>}`.

The account already deploys other `savankong/*` repos from GitHub, so App Platform has GitHub access. After the app is created:

1. Read the app's `default_ingress` (for example `qr-scan-xxxxx.ondigitalocean.app`).
2. Ask the owner to add a GoDaddy DNS record: **CNAME**, name `card`, value = that hostname.
3. DigitalOcean issues the HTTPS certificate when the record resolves (minutes, up to an hour).
4. Open `https://card.savankong.com` and check that QR links use that address.

Pushing to the deploy branch redeploys automatically. When the work merges to `main`, change `branch` in `.do/app.yaml` and in the live app.

## Verify

```sh
npm ci
npm test              # unit tests, including decoding generated QR codes with jsQR
npm run build
npx vite preview --port 4173 &
npm i --no-save playwright && npx playwright install chromium   # or use a global install
node scripts/verify-browser.mjs   # CHROMIUM_PATH=/opt/pw-browsers/chromium in Claude's cloud container
```

The browser script fills in a profile and decodes every QR code the app draws with jsQR, in each style and mode and on the wallpaper at 40% scale. It also checks the visitor page, the `.vcf` download, broken links and storage across tabs. Screenshots go to `.verify-shots/`.

A Chromium quirk: a full-page screenshot resets touch emulation, so the "this phone" wallpaper size is checked on a fresh page.

## Not verified yet

- Real iPhone and Android: camera prompts for vCard QR codes, Safari's handling of the `.vcf` download, and the share sheet's "Save Image".
- "Use GitHub photo", which calls `api.github.com` from the browser.

## Design references (Mobbin)

Luma and Telegram for the profile layout. Lapse, TikTok and GroupMe for QR share cards ("Scan the QR code to add me as a contact"). State Farm and GroupMe for a single clear "Save/Add to Contacts" action. Linktree for the wallpaper swatches.
