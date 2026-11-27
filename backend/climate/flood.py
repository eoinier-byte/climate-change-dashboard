import json

from django.conf import settings


def flood_regions() -> list[str]:
    return sorted(path.parent.name.lower() for path in settings.FLOOD_DIR.glob('*/index.json'))


def flood_region(slug: str) -> dict | None:
    path = settings.FLOOD_DIR / slug / 'index.json'
    if not path.is_file():
        return None
    return json.loads(path.read_text(encoding='utf-8'))
