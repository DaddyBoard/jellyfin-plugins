# Sonarr Placeholder

Jellyfin 12 plugin that displays greyed-out placeholder episode cards for episodes tracked by Sonarr but not yet downloaded or aired.

## Problem

When a user requests a show that is still airing weekly, Jellyfin only shows the episodes actually on disk (e.g. 1 season with 1 episode), making it look incomplete.

## Solution

This plugin integrates with Sonarr to show:
- **Unaired episodes** - with countdown timers (e.g. "3d 4h") until air date
- **Aired but missing episodes** - clearly marked as "Missing"
- **Placeholder cards** - greyed out and non-clickable, displayed alongside real episodes in correct order

## Features

- **Sonarr Integration**: Uses Sonarr v3 API to find tracked episodes
- **Smart Matching**: Matches series via TVDB/IMDb provider IDs
- **Live Countdowns**: Shows time remaining until episode airs (format: `Xd Nh`)
- **Configurable Display**: Choose which types of episodes to show (unaired, aired-but-missing)
- **Performance**: Caches Sonarr data to minimize API calls
- **Non-intrusive**: Placeholders don't create fake library items or pollute the database

## Requirements

- **Jellyfin 12** - This plugin targets Jellyfin 12.0.0
- **File Transformation 3.0+** - Required to inject client-side JavaScript into the web UI
  - Install from the Jellyfin plugin catalog before installing this plugin
- **Sonarr v3** - Must have a running Sonarr instance with API access

## Installation

### From Catalog (Recommended)

1. In Jellyfin: **Dashboard → Plugins → Repositories → Add**

```
https://raw.githubusercontent.com/DaddyBoard/jellyfin-plugins/main/manifest.json
```

2. **Catalogue → install "Sonarr Placeholder"** → restart Jellyfin
3. **Dashboard → Plugins → Sonarr Placeholder** → configure (see below)
4. Hard-refresh the web client (`Ctrl+F5`)

### Manual Build

```bash
dotnet publish Jellyfin.Plugin.SonarrPlaceholder/Jellyfin.Plugin.SonarrPlaceholder.csproj -c Release
```

Copy `Jellyfin.Plugin.SonarrPlaceholder.dll` into `/config/plugins/Sonarr Placeholder_1.0.0.0/`.

## Configuration

Navigate to **Dashboard → Plugins → Sonarr Placeholder**

### Sonarr Connection
- **Sonarr URL**: Base URL of your Sonarr instance (e.g., `http://localhost:8989`)
- **Sonarr API Key**: Found in Sonarr under Settings → General → Security
- **Test Connection**: Click to verify the connection works

### Display Options
- **Enable Sonarr Placeholder**: Master switch to enable/disable the plugin
- **Show aired but missing episodes**: Include episodes that have aired but aren't downloaded yet
- **Show unaired episodes**: Include episodes that haven't aired yet
- **Maximum days ahead**: How far into the future to show unaired episodes (1-3650 days)

### Performance
- **Cache duration (minutes)**: How long to cache Sonarr data before refreshing (1-120 minutes)

### Example Configuration

```
Sonarr URL: http://localhost:8989
API Key: 1234567890abcdef1234567890abcdef
Enable: ✓
Show aired but missing: ✓
Show unaired: ✓
Max days ahead: 365 days
Cache duration: 5 minutes
```

## How It Works

### Server-side (C#)
- `SonarrService` handles all Sonarr API communication with caching
- Matches Jellyfin series to Sonarr series via provider IDs (TVDB/IMDb)
- Filters episodes based on configuration (aired/unaired, monitoring status)
- Exposes REST API endpoint for client-side JavaScript

### Client-side (JavaScript)
- Injected into Jellyfin web UI via File Transformation plugin
- Detects when user views a series/season page
- Fetches missing episodes from plugin API
- Creates placeholder cards by cloning existing episode cards
- Adds countdown timers and styling
- Updates countdowns every minute

### Security
- Sonarr API key stays server-side only
- Browser never communicates with Sonarr directly
- All API calls authenticated with Jellyfin session

### Matching Logic

The plugin matches Jellyfin series to Sonarr series using:
1. **TVDB ID** (primary, most reliable)
2. **IMDb ID** (fallback)
3. Series not found in Sonarr are silently skipped (no placeholders shown)

### Placeholder Cards

Placeholder episodes:
- Are **greyed out** with a diagonal stripe pattern
- Show **episode number and title** (or "TBA" if title unknown)
- Display **countdown timer** for unaired episodes (e.g., "3d 4h")
- Show **air date** in user's locale format
- Are marked as **"Not aired"** or **"Missing"** depending on status
- Are **non-clickable** and don't navigate anywhere
- Update countdown timers **every minute** automatically

## Troubleshooting

### Placeholders Not Appearing

1. **Check File Transformation is installed**: Dashboard → Plugins → Installed
2. **Verify Sonarr connection**: Dashboard → Plugins → Sonarr Placeholder → Test Connection
3. **Confirm series has provider IDs**: Dashboard → Series → Metadata → Check for TVDB or IMDb ID
4. **Check browser console**: Look for errors from `SonarrPlaceholder`
5. **Hard refresh**: `Ctrl+F5` after configuration changes
6. **Debug in console**: Run `SonarrPlaceholder.getState()` in browser console to see plugin state

### Countdown Timers Not Updating

- Timers update every 60 seconds
- Check browser console for JavaScript errors
- Verify the episode has a valid `airDateUtc` in Sonarr

### Wrong Episodes Shown

- Check Sonarr's monitoring settings (unmonitored episodes are excluded)
- Verify Sonarr has the correct metadata for the series
- Adjust "Show aired but missing" / "Show unaired episodes" settings

### Performance Issues

- Increase cache duration (reduces API calls)
- Reduce "Maximum days ahead" (fewer episodes to process)
- Check Sonarr server performance

## Design Notes

- **No fake library items**: Placeholders are purely client-side DOM elements that don't pollute the database or show up in other clients
- **File Transformation dependency**: Standard method for injecting JavaScript into Jellyfin web UI without forking jellyfin-web
- **Caching strategy**: Reduces Sonarr API load while maintaining reasonable freshness (configurable)
- **Graceful degradation**: If Sonarr is unreachable, plugin shows nothing extra (no errors)

## License

Same license as the parent repository.
