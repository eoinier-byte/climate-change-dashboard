import anthropic

from config import settings

client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

message = client.messages.create(
    model='claude-haiku-4-5',
    max_tokens=1000,
    messages=[
        {
            'name': 'get_projections',
            'description': 'Climate projections for one Irish county',
            'input_schema': {
                'type': 'object',
                'properties': {
                    'county': {'type': 'string', 'description': 'county slug, e.g. "cork"'},
                    'variable': {'type': 'string', 'enum': ['temperature', 'precipitation']}
                },
                'required': ['county']
            }
        }
    ],
)

for block in message.content:
    if block.type == 'text':
        print(block.text)