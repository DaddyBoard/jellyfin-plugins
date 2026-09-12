import hashlib
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path


def main():
    zip_path = Path(sys.argv[1])
    version = sys.argv[2]
    source_url = sys.argv[3]
    changelog = os.environ.get("CHANGELOG") or (sys.argv[4] if len(sys.argv) > 4 else "Automated release")
    manifest_path = Path("manifest.json")
    checksum = hashlib.md5(zip_path.read_bytes()).hexdigest()
    entry = {
        "checksum": checksum,
        "changelog": changelog,
        "targetAbi": "12.0.0.0",
        "sourceUrl": source_url,
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "version": version
    }
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    versions = [item for item in (manifest[0].get("versions") or []) if item.get("version") != version]
    versions.insert(0, entry)
    manifest[0]["versions"] = versions
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(checksum)


if __name__ == "__main__":
    main()
