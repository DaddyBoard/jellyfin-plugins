#!/usr/bin/env python3
import hashlib
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path


def main():
    if len(sys.argv) < 7:
        print("Usage: update-manifest.py <zip> <version> <source_url> <plugin_guid> <plugin_name> <plugin_metadata_json>", file=sys.stderr)
        sys.exit(1)
    
    zip_path = Path(sys.argv[1])
    version = sys.argv[2]
    source_url = sys.argv[3]
    plugin_guid = sys.argv[4]
    plugin_name = sys.argv[5]
    plugin_metadata = json.loads(sys.argv[6])
    
    changelog = os.environ.get("CHANGELOG") or "Automated release"
    manifest_path = Path("manifest.json")
    
    checksum = hashlib.md5(zip_path.read_bytes()).hexdigest()
    
    version_entry = {
        "checksum": checksum,
        "changelog": changelog,
        "targetAbi": plugin_metadata.get("targetAbi", "12.0.0.0"),
        "sourceUrl": source_url,
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "version": version
    }
    
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    
    plugin_entry = None
    for entry in manifest:
        if entry.get("guid") == plugin_guid:
            plugin_entry = entry
            break
    
    if not plugin_entry:
        plugin_entry = {
            "guid": plugin_guid,
            "name": plugin_name,
            "description": plugin_metadata.get("description", ""),
            "overview": plugin_metadata.get("overview", ""),
            "owner": plugin_metadata.get("owner", ""),
            "category": plugin_metadata.get("category", "General"),
            "versions": []
        }
        manifest.append(plugin_entry)
    
    versions = [item for item in (plugin_entry.get("versions") or []) if item.get("version") != version]
    versions.insert(0, version_entry)
    plugin_entry["versions"] = versions
    
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(checksum)


if __name__ == "__main__":
    main()
