import anthropic
from anthropic.types import ToolParam
from anthropic.types.beta import BetaUserMessageParam

from ai_agent.utils import get_projections
from common.enums import Season, Variable
from config import settings

TOKENS = 2000
SYSTEM = (
    'You answer questions about climate projections for Irish counties. '
    'Always get numbers with the get_projections tool; never invent them. '
    'Always state the unit, scenario, period and the 1976-2005 baseline. '
    'Call them projections, not forecasts. Keep answers short.'
)

TOOLS: list[ToolParam] = [
    {
        'name': 'get_projections',
        'description': (
            'Climate projections for one Irish county: baseline (1976-2005) and values '
            'for 2021-2050 and 2071-2100 under RCP2.6, RCP4.5 and RCP8.5.'
        ),
        'input_schema': {
            'type': 'object',
            'properties': {
                'county': {'type': 'string', 'description': "County slug, lowercase, e.g. 'cork'"},
                'variable': {'type': 'string', 'enum': [v.value for v in Variable]},
                'season': {'type': 'string', 'enum': [s.value for s in Season]},
            },
            'required': ['county', 'variable'],
            'additionalProperties': False,
        },
        'strict': True,
    }
]


def ask(question: str) -> str:
    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    messages: list[BetaUserMessageParam] = [{'role': 'user', 'content': question}]

    runner = client.beta.messages.tool_runner(
        model='claude-haiku-5-5',
        max_tokens=TOKENS,
        system=SYSTEM,
        tools=[get_projections],
        messages=messages,
    )
    final = runner.until_done()
    answer = ''.join(b.text for b in final.content if b.type == 'text')
    print(answer)
    return answer
