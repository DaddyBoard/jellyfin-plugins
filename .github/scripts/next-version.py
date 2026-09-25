#!/usr/bin/env python3
import json
import sys
from pathlib import Path


def parse_version(value):
    parts = str(value).split(".")
    numbers = []
    for part in parts[:4]:
        numbers.append(int(part))
    while len(numbers) < 4:
        numbers.append(0)
    return tuple(numbers)


def main():
    if len(sys.argv) < 3:
        print("Usage: next-version.py <manifest.json> <plugin-guid>", file=sys.stderr)
        sys.exit(1)
    
    path = Path(sys.argv[1])
    plugin_guid = sys.argv[2]
    
    data = json.loads(path.read_text(encoding="utf-8"))
    
    plugin_entry = None
    for entry in data:
        if entry.get("guid") == plugin_guid:
            plugin_entry = entry
            break
    
    if not plugin_entry:
        print("1.0.0.0")
        return
    
    versions = plugin_entry.get("versions") or []
    if not versions:
        print("1.0.0.0")
        return
    
    latest = max(parse_version(item.get("version", "0.0.0.0")) for item in versions)
    next_parts = list(latest)
    next_parts[3] += 1
    print(".".join(str(part) for part in next_parts))


if __name__ == "__main__":
    main()
