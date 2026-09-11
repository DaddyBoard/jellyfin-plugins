# GitHub Release Command

After the PR is merged to `main`, create a GitHub Release with the following command:

```bash
gh release create v1.0.0.0 \
  --title "Custom Tabs JF12 v1.0.0.0" \
  --notes "Initial release for Jellyfin 12

## Features
- Add custom tabs to the Jellyfin navigation bar
- Opens external URLs in an overlay iframe
- MutationObserver ensures tabs persist through navigation
- Easy configuration through plugin settings
- Built for Jellyfin 12 with File Transformation plugin support

## Installation
1. Remove old Paradox Custom Tabs plugin (GUID fbacd0b6) if installed
2. Install File Transformation plugin v3.x
3. Add this repository URL to Jellyfin Dashboard → Plugins → Repositories:
   \`\`\`
   https://raw.githubusercontent.com/DaddyBoard/jellyfin-plugins/main/manifest.json
   \`\`\`
4. Install Custom Tabs JF12 from the catalogue
5. Restart Jellyfin

## Requirements
- Jellyfin 12.0.0+
- File Transformation plugin v3.x (GUID: 5e87cc92-571a-4d8d-8d98-d2d4147f9f90)" \
  dist/customtabs/CustomTabsJF12-1.0.0.0.zip
```

## Important Notes

1. **Run from repository root**: Ensure you're in `/workspace` before running the command
2. **Public accessibility**: The release assets MUST be publicly downloadable for the catalogue installation method to work
3. **Verify checksum**: The current build has MD5 `94A463E54A6612A24548D98E328ABDEF`

## Alternative: Manual Release via GitHub UI

If `gh` CLI is not available:

1. Go to https://github.com/DaddyBoard/jellyfin-plugins/releases/new
2. Tag: `v1.0.0.0`
3. Target: `main`
4. Release title: `Custom Tabs JF12 v1.0.0.0`
5. Description: (use the notes from above)
6. Attach file: `dist/customtabs/CustomTabsJF12-1.0.0.0.zip`
7. Click "Publish release"

## Post-Release Verification

After creating the release, verify:

1. The zip is publicly downloadable at:
   ```
   https://github.com/DaddyBoard/jellyfin-plugins/releases/download/v1.0.0.0/CustomTabsJF12-1.0.0.0.zip
   ```

2. The manifest.json sourceUrl matches this URL

3. Test installation via catalogue in a Jellyfin 12 instance
