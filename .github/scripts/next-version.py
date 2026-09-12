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
    path = Path(sys.argv[1])
    data = json.loads(path.read_text(encoding="utf-8"))
    versions = data[0].get("versions") or []
    if not versions:
        print("1.0.0.0")
        return
    latest = max(parse_version(item.get("version", "0.0.0.0")) for item in versions)
    next_parts = list(latest)
    next_parts[3] += 1
    print(".".join(str(part) for part in next_parts))


if __name__ == "__main__":
    main()
