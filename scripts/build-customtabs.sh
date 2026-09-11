#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SRC_DIR="$REPO_ROOT/src/customtabs"
DIST_DIR="$REPO_ROOT/dist/customtabs"
VERSION="1.0.1.0"
ZIP_NAME="CustomTabsJF12-${VERSION}.zip"

echo "Building Custom Tabs JF12 plugin..."
cd "$SRC_DIR"

dotnet restore
dotnet build --configuration Release

echo "Creating release package..."
rm -rf build
mkdir -p build

cp -r bin/Release/net10.0/* build/

cd build
rm -f "../../../dist/customtabs/${ZIP_NAME}"
mkdir -p "$DIST_DIR"
zip -r "$DIST_DIR/${ZIP_NAME}" ./*

echo "Package created: dist/customtabs/${ZIP_NAME}"

echo "Calculating MD5 checksum..."
cd "$DIST_DIR"
MD5_HASH=$(md5sum "${ZIP_NAME}" | awk '{print toupper($1)}')
echo "MD5: $MD5_HASH"

echo "Updating manifest.json..."
cd "$REPO_ROOT"

if [ -f "manifest.json" ]; then
    TEMP_JSON=$(mktemp)
    jq --arg md5 "$MD5_HASH" '.[0].versions[0].checksum = $md5' manifest.json > "$TEMP_JSON"
    mv "$TEMP_JSON" manifest.json
    echo "Manifest updated with checksum: $MD5_HASH"
    
    if [ -f "repository/manifest.json" ]; then
        cp manifest.json repository/manifest.json
        echo "Repository manifest also updated"
    fi
else
    echo "Warning: manifest.json not found, skipping checksum update"
fi

echo "Build complete!"
