# IPTVnator Copilot Instructions

## Architecture Overview

IPTVnator is a cross-platform IPTV player built with **Angular 20 + Tauri** (migrated from Electron). The app supports M3U/M3U8 playlists, Xtream Code APIs, and Stalker portals with EPG (Electronic Program Guide) functionality.

### Dual Environment Pattern

The app runs in two environments with shared codebase:
- **PWA Mode**: Web version (`npm run serve`) - uses `PwaService`
- **Tauri Mode**: Desktop app (`npm run tauri dev`) - uses `TauriService`

Environment detection via `isTauri()` determines service injection in `DataFactory()` (`app.module.ts`).

## Key Components

### State Management (NgRx)
- **Central Store**: `src/app/state/` - manages playlists, channels, active content
- **Entity Adapter**: Uses `@ngrx/entity` for playlist collection in `playlists.state.ts`
- **Key Selectors**: `selectActive`, `selectChannels`, `selectPlaylists` for component data binding

### Data Layer
- **Abstract Service**: `DataService` defines contract for both environments
- **Platform Services**: `TauriService` (desktop) vs `PwaService` (web) implement different backends
- **IPC Communication**: Tauri commands in `src-tauri/src/commands/` handle file I/O, media players
- **Persistence**: IndexedDB via `ngx-indexed-db` for web, SQLite for desktop

### Player Architecture
Multiple video player implementations in `src/app/player/components/`:
- `html-video-player`: Default HLS.js player
- `vjs-player`: Video.js-based player
- `art-player`: Alternative player component
- External players: MPV/VLC via Tauri commands

## Critical Patterns

### Playlist Parsing
```typescript
// All playlists follow this pattern (shared/playlist.utils.ts)
const playlistObject = createPlaylistObject(name, parsedPlaylist, url, 'URL');
// Generates UUID, normalizes channel structure, sets metadata
```

### Channel Structure
Channels use standardized interface (`shared/channel.interface.ts`) with:
- `tvg`: EPG metadata
- `http`: Headers (user-agent, referrer, origin)
- `catchup`: Time-shift/archive support

### Routing Strategy
- Lazy-loaded components via `loadComponent()`
- Environment-specific routes: Tauri gets `xtreamRoutes`, PWA gets fallback
- Dynamic playlist IDs: `/playlists/:id` pattern

## Development Workflows

### Build Commands
```bash
npm run serve          # PWA development
npm run tauri dev      # Desktop development (requires Rust)
npm run build:prod     # Production Angular build
npm run build:web      # Web-specific build
```

### Testing
```bash
npm run test           # Jest unit tests
npm run e2e           # Playwright e2e with UI
npm run e2e:ci        # CI-friendly e2e
```

### Code Quality
- ESLint with Angular-specific rules
- Prettier formatting
- Husky git hooks
- Conventional commits

## Integration Points

### Tauri Backend (Rust)
- **Commands**: `src-tauri/src/commands/` expose Rust functions to frontend
- **EPG Processing**: `epg.rs` handles TV guide data parsing
- **Media Integration**: `media.rs` launches external players (MPV/VLC)
- **Database**: SQLite migrations in `database.rs`

### External APIs
- **Xtream Code**: API client in `TauriService.forwardXtreamRequest()`
- **Stalker Portal**: MAC address-based authentication
- **EPG Sources**: XMLTV format parsing for TV guides

### File System Integration
- **Playlist Import**: File picker → parse → IndexedDB/SQLite
- **Auto-refresh**: Background updates for URL-based playlists
- **Export**: Favorites aggregation across playlists

## Development Notes

- **Shared Code**: `shared/` directory contains interfaces used by both Angular and Tauri
- **Environment Files**: Different configs for dev/prod/web in `src/environments/`
- **Material Design**: Uses Angular Material with custom M3 theming
- **Internationalization**: 16 languages via `@ngx-translate`
- **PWA Features**: Service worker, manifest, offline support (web only)

## Common Tasks

**Adding new playlist source**: Extend `Playlist` interface, update parser in `playlist.utils.ts`
**New player integration**: Create component in `player/components/`, add to video player switch
**API endpoint**: Add Tauri command in `src-tauri/src/commands/`, invoke from service
**State updates**: Add actions/reducers in `state/`, update selectors