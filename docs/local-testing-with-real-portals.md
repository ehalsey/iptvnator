# Local Testing with Real Portals

This guide explains how to run IPTVnator locally and connect it to a real IPTV portal (Xtream Codes or Stalker) for development and testing.

## Prerequisites

- Node.js (v18+)
- pnpm (via `corepack enable`)
- Dependencies installed: `pnpm install`

## Architecture Overview

In PWA/web mode, the Angular app cannot call external IPTV APIs directly due to browser CORS restrictions. A local CORS proxy (`cors-proxy.js`) sits between the browser and the real portal server:

```
Browser (localhost:4200)  -->  CORS Proxy (localhost:3000)  -->  Real Portal Server
```

The proxy handles three routes:
- `/xtream` — Xtream Codes API calls
- `/stalker` — Stalker portal API calls
- `/parse` — M3U playlist fetching

## Quick Start

### 1. Start the CORS proxy

In one terminal:

```bash
node cors-proxy.js
```

This starts the proxy on port 3000. You should see:

```
CORS proxy running at http://localhost:3000
Ready to proxy Xtream, Stalker, and M3U requests.
```

### 2. Start the Angular dev server

In a second terminal:

```bash
pnpm run serve:frontend
```

This starts the Angular app at `http://localhost:4200`. The dev environment is pre-configured to use `http://localhost:3000` as the backend URL (see `apps/web/src/environments/environment.ts`).

### 3. Open the app and add your portal

Open `http://localhost:4200` in your browser and add a playlist:

#### Xtream Codes Portal

1. Click "Add Playlist" or navigate to the sources/add page
2. Select "Xtream Codes API"
3. Enter your portal details:
   - **Server URL**: Your provider's server URL (e.g. `http://example.com:8080`)
   - **Username**: Your Xtream username
   - **Password**: Your Xtream password
4. Save and open the portal

#### Stalker Portal

1. Click "Add Playlist" or navigate to the sources/add page
2. Select "Stalker Portal"
3. Enter your portal details:
   - **Portal URL**: Your provider's portal URL (e.g. `http://example.com/c/`)
   - **MAC Address**: Your MAC address (e.g. `00:1A:79:XX:XX:XX`)
4. Save and open the portal

#### M3U Playlist

1. Click "Add Playlist" or navigate to the sources/add page
2. Select "M3U/M3U8"
3. Provide a remote URL to your `.m3u` or `.m3u8` file
4. Save and open the playlist

## Using the Electron App Instead

If you want the full desktop experience (with local database, external player support, etc.), run:

```bash
pnpm run serve:backend
```

This starts both the Electron app and the Angular dev server. The Electron app makes API calls directly (no CORS proxy needed) and uses a local SQLite database at `~/.iptvnator/databases/iptvnator.db`.

## Using Mock Servers

For development without a real portal subscription, mock servers are available:

- **Xtream mock**: `pnpm nx run xtream-mock-server:serve` (port 3211)
  - Use `user1` / `pass1` as credentials, server URL `http://localhost:3211`
  - See `docs/architecture/xtream-mock-server.md` for all scenarios

- **Stalker mock**: `pnpm nx run stalker-mock-server:serve` (port 3210)
  - Use `http://localhost:3210/portal.php` as portal URL
  - Use `00:1A:79:00:00:01` as MAC address
  - See `docs/architecture/stalker-mock-server.md` for all scenarios

## Troubleshooting

### CORS errors in browser console

Make sure `cors-proxy.js` is running on port 3000. The Angular dev environment expects the proxy at `http://localhost:3000`.

### Portal returns authentication errors

- Double-check your credentials (username/password or MAC address)
- Some portals restrict access by IP — make sure your IP is authorized
- Check the CORS proxy terminal for request logs and error details

### Streams won't play in browser

- Many IPTV streams use plain HTTP. Modern browsers may block mixed content (HTTP streams on an HTTPS page). The dev server runs on HTTP, so this shouldn't be an issue locally.
- Some streams use formats not supported by the browser's built-in player. The app will try HLS.js, Video.js, and mpegts.js as fallbacks.
- If a stream format is unsupported in the browser, use the Electron app with an external player (MPV or VLC).

### Proxy timeout errors

The CORS proxy has a 15-second timeout. If your portal is slow to respond, you can increase the timeout in `cors-proxy.js` (line 23: `req.setTimeout(15000, ...)`).
