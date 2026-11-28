from functools import cache

import anthropic
from django.conf import settings


@cache
def get_client() -> anthropic.Anthropic:
    return anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY, timeout=30.0)
