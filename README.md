# Jellyfin Plugins by DaddyBoard

A monorepo for custom Jellyfin plugins.

## Plugins

### Custom Tabs JF12

Add custom tabs to the Jellyfin navigation bar for quick access to external sites and tools.

**Features:**
- Injects custom navigation buttons into the Jellyfin Modern UI
- Opens external URLs in an overlay iframe
- Easy configuration through the plugin settings page
- Multiple tabs supported
- MutationObserver ensures tabs persist through navigation

**Requirements:**
- Jellyfin 12.0.0+
- File Transformation plugin v3.x (GUID: `5e87cc92-571a-4d8d-8d98-d2d4147f9f90`)

## Installation

### Prerequisites

1. **Remove old Paradox Custom Tabs plugin** if installed (GUID `fbacd0b6`):
   - Go to Dashboard → Plugins
   - Uninstall the old "Custom Tabs" plugin
   - Restart Jellyfin

2. **Install File Transformation plugin v3.x**:
   - This is a required dependency
   - Install from the official Jellyfin repository or manually

### Installing Custom Tabs JF12

#### Method 1: Via Catalogue (Recommended)

1. Go to Dashboard → Plugins → Repositories
2. Add this repository URL:
   ```
   https://raw.githubusercontent.com/DaddyBoard/jellyfin-plugins/main/manifest.json
   ```
3. Go to Dashboard → Plugins → Catalog
4. Find "Custom Tabs JF12" and click Install
5. Restart Jellyfin

**Note:** Release assets must be publicly downloadable for this method to work. If this repository is private, use Method 2.

#### Method 2: Manual Installation

1. Download `CustomTabsJF12-1.0.0.0.zip` from the [Releases page](https://github.com/DaddyBoard/jellyfin-plugins/releases)
2. Extract the zip contents to: `<Jellyfin-Data-Dir>/plugins/Custom Tabs JF12/`
3. Restart Jellyfin

### Configuration

1. Go to Dashboard → Plugins → Custom Tabs JF12
2. Click "Add Tab" to create a new tab
3. Configure:
   - **Title**: The text shown on the navigation button
   - **URL**: The website to open in the iframe
   - **Enabled**: Toggle to enable/disable the tab
4. Click "Save"
5. Refresh your browser to see the new tabs

## Development

### Building

To build the Custom Tabs JF12 plugin:

```bash
./scripts/build-customtabs.sh
```

This will:
1. Build the plugin
2. Create a release zip in `dist/customtabs/`
3. Calculate the MD5 checksum
4. Update `manifest.json` with the new checksum

### Project Structure

```
/
  manifest.json                 # Jellyfin plugin catalogue (Paradox format)
  README.md
  src/
    customtabs/                 # Custom Tabs JF12 plugin source
      CustomTabsJF12.csproj
      Plugin.cs
      Configuration/
        PluginConfiguration.cs
        configPage.html
        configPage.js
      Api/
        TabsController.cs
  dist/
    customtabs/                 # Built release zips
      CustomTabsJF12-1.0.0.0.zip
  repository/                   # Optional mirror of catalogue files
    manifest.json
  scripts/
    build-customtabs.sh         # Build script
```

### Creating a Release

After building:

```bash
gh release create v1.0.0.0 \
  --title "Custom Tabs JF12 v1.0.0.0" \
  --notes "Initial release for Jellyfin 12" \
  dist/customtabs/CustomTabsJF12-1.0.0.0.zip
```

Ensure the release assets are publicly downloadable for the catalogue installation method to work.

## Technical Details

### Custom Tabs JF12

- **GUID**: `7c3f8a92-4b1d-4e8f-9a2c-5d6e7f8a9b0c`
- **Version**: 1.0.0.0
- **Target Framework**: .NET 10.0
- **Jellyfin Version**: 12.0.0+ (uses RC5 NuGet packages)
- **Dependencies**: File Transformation plugin (GUID `5e87cc92-571a-4d8d-8d98-d2d4147f9f90`)

### How It Works

1. Registers a file transformation with the File Transformation plugin for `index.html`
2. Injects client-side JavaScript that:
   - Finds the MUI toolbar navigation (`.MuiToolbar-root .MuiStack-root`)
   - Fetches tab configuration from `/CustomTabsJF12/Tabs` API endpoint
   - Appends MUI-styled buttons for each enabled tab
   - Opens URLs in an overlay iframe with close button and ESC key support
   - Uses MutationObserver to re-inject on navigation
   - Provides detailed console logging with `[CustomTabsJF12]` prefix

## License

MIT
