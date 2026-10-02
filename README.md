# QR-Scan

> **Work in progress.** See [HANDOFF.md](HANDOFF.md) for the current status, open decisions and next steps.

A web app that turns your professional details into a QR code. Put the code on your phone's lock screen, or share it as a link or image. Its main job: the person who scans it saves your contact in as few taps as possible.

Visitors see your card at the site's address (`https://card.savankong.com/`). You edit it at `#/edit`.

The app runs in the browser and needs no server or account. Your details are stored on your own device.

## What you can do

- **Build your card.** The card page puts **Save to Contacts** first, then Call, Text and Email, your links, and a link that lets visitors text you their number. Add a photo, your name, title, company, location, a short bio, email, phone and any number of links. A live preview shows what people see after they scan.
- **Make the QR code.** Choose what a scan does:
  - **Straight to Contacts** (the default, and the fastest) puts a contact card (vCard) inside the code. The camera offers to add you to contacts in about 3 taps, with no internet. A QR code has no room for a photo, so the contact includes a "My card" link to your card page. Switches under **In your contact** choose which details go in: fewer details make a simpler code.
  - **Open my card page** opens your card page. Its first and largest button is **Save to Contacts**, which saves your photo too (about 4 taps).

  You can also pick the module style (rounded, square or dots), use your accent color or black, and put your photo in the middle of the code. A meter shows how easy the code is to scan.
- **Make a wallpaper.** Choose your phone model, a gradient, a solid color or your own photo, and position the code below the lock-screen clock. Then save it at your phone's native resolution.
- **Share.** Use the share sheet, copy the link, or save the card as an image. You can also download the code as PNG or SVG (for print) and your contact as a `.vcf` file.

## Instant links and short links

With **Open my card page**, the code holds one of two kinds of link:

| | Instant link | Short link |
|---|---|---|
| Setup | None | Add `profile.json` to the site once |
| Where your details live | Inside the link | In `public/profile.json` |
| After you edit your card | Needs a new QR code and wallpaper | Same code, so re-upload `profile.json` only |
| Uploaded photo on the card page | No (initials are shown; a photo URL works) | Yes |
| Code density | Medium | Very low, easiest to scan |

Instant links keep your details in the URL fragment (after `#`), which browsers don't send to the server.

For a wallpaper you'll keep for a while, use a short link:

1. On the **QR code** tab, choose **Short** and then **Download profile.json**.
2. Put the file in this repository's `public/` folder. On GitHub, open `public`, choose **Add file → Upload files**, and commit.
3. When the site redeploys (about a minute), the short link shows your card. Repeat these steps whenever you edit your card. The code doesn't change.

The "My card" link inside a Straight to Contacts code opens the same address, so publish `profile.json` for that mode too.

`profile.json` is public, like the card itself.

## Hosting on DigitalOcean

The site runs on DigitalOcean App Platform as a free static site at **https://card.savankong.com**. The QR code must point to an address other phones can open, so deploy before you print or set a wallpaper.

The app's settings live in [`.do/app.yaml`](.do/app.yaml). App Platform builds the site with `npm run build` and serves `dist/`. Every push to the deploy branch (`claude/qr-card-app` for now) deploys again automatically.

To create the app the first time, open **DigitalOcean → Apps → Create App**, choose GitHub and `savankong/QR-Scan`, and use the settings from `.do/app.yaml`. You can also run `doctl apps create --spec .do/app.yaml`.

To connect the domain, add one DNS record for savankong.com at GoDaddy, where its DNS is hosted:

| Type | Name | Value |
|---|---|---|
| CNAME | `card` | `qr-scan-dwcyv.ondigitalocean.app` (the app's default address) |

DigitalOcean issues the HTTPS certificate once the record resolves. That usually takes a few minutes and can take up to an hour.

To install the app on your phone, open the site and use **Share → Add to Home Screen** on iPhone or **Install app** on Android. If you open the app somewhere other than its public address, set **Public address of this app** on the QR code tab.

## Set the wallpaper

- **iPhone:** Tap **Save wallpaper**, then **Save Image**. In Photos, open the image and tap **Share → Use as Wallpaper**. Pick your Lock Screen and turn off **Depth Effect**, so the code stays sharp and in place.
- **Android:** Save the image, open it in Photos or Gallery, then tap **⋮ → Use as → Wallpaper → Lock screen**.

## Develop

Requires Node.js 22.12 or later.

```sh
npm install
npm run dev       # http://localhost:5173
npm test          # unit tests, including decoding generated QR codes
npm run build     # type-check and build to dist/
```

To test on your phone during development, run `npm run dev -- --host` and open the network address it prints. QR codes made from a local address only work on your own network.

### Project layout

```
src/
  App.tsx                  Routes: published card at the root (#/card still works), #/edit and the other editor tabs, #/c/<data> (instant card)
  components/
    ProfileEditor.tsx      Photo, details, links and accent color
    ProfileCard.tsx        The page people see after they scan
    SharePanel.tsx         QR code tab: modes, style, publish, downloads
    WallpaperStudio.tsx    Lock-screen wallpaper editor
  lib/
    codec.ts               Packs a profile into a compact link and back
    qr.ts                  QR layout, canvas and SVG rendering
    wallpaper.ts           Wallpaper and share-image composition
    vcard.ts               vCard 3.0 output
    profile.ts             Profile model, link rules and validation
```
