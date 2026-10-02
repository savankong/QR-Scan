# Handoff notes

Status as of 2 October 2026. Everything below is on the `claude/qr-card-app` branch.

## The goal

The person who scans the QR code must be able to save Savan's contact **as quickly and easily as possible**. This is the most important job of the app, so judge every design and code choice against it.

## Where things stand

| Area | State |
|---|---|
| App (v1) | Built, tested and pushed: profile editor, QR code tab, wallpaper maker and visitor card page. See [README.md](README.md). |
| Tests | 18 unit tests (`npm test`) pass. 22 browser checks pass (see [Verify](#verify)). |
| Hosting config | DigitalOcean App Platform static site, defined in [`.do/app.yaml`](.do/app.yaml). The GitHub Pages workflow was removed on purpose: hosting is DigitalOcean only. |
| Deployment | **Not deployed yet.** The app spec passed DigitalOcean's dry run (`POST /v2/apps/propose`): name `qr-scan` is free, and it fits the account's free static-site slots (1 of 3 used). Creating the app was blocked by the previous session's safety check and needs the owner's explicit go-ahead. |
| Domain | `card.savankong.com` was chosen. The spec already lists it. DNS for savankong.com is at **GoDaddy** (`ns69/ns70.domaincontrol.com`), and there's no `card` record yet. |
| Redesign | Designs for "fastest save" are drafted ([docs/design/](docs/design/)) and **waiting for the owner's approval. Don't build them before that.** |

## Open decisions (ask the owner)

1. **Approve the designs.** In particular: should the QR code save the contact directly (Option A) by default, with the card page as the link people share (Option B)?
2. **Go-ahead to create the DigitalOcean app.** Then give the owner the exact GoDaddy CNAME value.
3. **What visitors see at `https://card.savankong.com/`.** Today the root opens the editor and the visitor card lives at `#/card` or `#/c/<data>`. For a clean link, visitors should probably get the card at the root and the editor should move to `#/edit`. This changes routing, so confirm it.

## The design proposal (docs/design)

These are artboards for the Claude Design canvas; [docs/design/README.md](docs/design/README.md) explains how to open them. The original canvas is private to the previous account, at https://claude.ai/artifact/7avqQoRMqxbCL1zGZaAmfZ. Its owner can share it from the page's Share menu.

- **Option A, Straight to Contacts (recommended for the wallpaper).** The QR code holds a compact vCard. The person scans, taps the camera prompt, and taps Create New Contact: about 3 taps, works offline, no page load. A QR code can't hold a photo, so the vCard includes a "My card" URL to the card page, where the photo and all links are.
- **Option B, Card page first (best for shared links).** The QR code opens the card page, with **Save to Contacts** as the first and largest control. It takes about 4 taps and needs signal, but the saved contact includes the photo.
- **Card page:** save-first layout, then a Call/Text/Email row, then links, then "Text Savan your number" (an `sms:` link so people can send their number back). After the person taps Save, an "Almost done" note says to tap *Create New Contact* (iPhone) or *Save* (Android).
- **QR tab:** a picker between A and B with tap counts, "In your contact" switches to choose which fields go into the vCard (fewer fields make a simpler code), and the readability meter.
- **Wallpaper:** a larger code, a name and photo row, and the caption "Scan to save my contact".

The tap counts are estimates. Nobody has checked the exact prompts on a real iPhone or Android.

## Implementation plan once the designs are approved

1. **Settings** (`src/lib/settings.ts`): default `qrMode` to `'vcard'`. Add a field selection for the vCard (title/company, phone, email, each link type, card link) and sanitize it.
2. **vCard** (`src/lib/vcard.ts`): in compact mode, honor the field selection, and add the card-page URL with a short label such as `item1.URL` + `X-ABLabel:My card`. Keep an eye on the readability meter: a full profile is now about 77×77 modules, so trimming fields matters.
3. **Card page** (`src/components/ProfileCard.tsx`): use the save-first layout from `docs/design/Card.dc.html`. **Build the vCard blob when the page loads**, not on tap: today `downloadContact` fetches the photo after the tap, which delays the save and can lose the browser's user-gesture allowance on iOS. Add the "Almost done" state and the "Text Savan your number" link.
4. **QR tab** (`src/components/SharePanel.tsx`): use the option cards and field switches from `docs/design/OwnerQR.dc.html`.
5. **Wallpaper** (`src/lib/wallpaper.ts`, `WallpaperStudio.tsx`): change the default caption to "Scan to save my contact", add the name and photo row, and make the default size a little larger.
6. **Routing** (`src/hooks.ts` `parseRoute`, `src/App.tsx`): only after decision 3 above.
7. Update the unit tests and the browser checks to match.

## Deploying to DigitalOcean

**Never commit an API token.** The previous session's token was pasted into chat and should be revoked (DigitalOcean → API → Tokens). Use a fresh token from an environment variable such as `DIGITALOCEAN_TOKEN`.

Create the app with one of these, after the owner approves:

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
node scripts/verify-browser.mjs
```

The browser script fills in a profile and decodes every QR code the app draws with jsQR, in each style and mode and on the wallpaper at 40% scale. It also checks the visitor page, the `.vcf` download, broken links and storage across tabs. Screenshots go to `.verify-shots/`.

A Chromium quirk: a full-page screenshot resets touch emulation, so the "this phone" wallpaper size is checked on a fresh page.

## Not verified yet

- Real iPhone and Android: camera prompts for vCard QR codes, Safari's handling of the `.vcf` download, and the share sheet's "Save Image".
- "Use GitHub photo", which calls `api.github.com` from the browser.

## Design references (Mobbin)

Luma and Telegram for the profile layout. Lapse, TikTok and GroupMe for QR share cards ("Scan the QR code to add me as a contact"). State Farm and GroupMe for a single clear "Save/Add to Contacts" action. Linktree for the wallpaper swatches.
