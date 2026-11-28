from http import HTTPStatus

import anthropic
from django.core.cache import cache
from django.http import StreamingHttpResponse
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework.exceptions import NotFound, Throttled, ValidationError
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from ai_agent.agent import stream_ask
from ai_agent.commentary import UNAVAILABLE, generate_commentary
from ai_agent.serializers import ChatSerializer
from ai_agent.throttless import ChatAnonThrottle, ChatUserThrottle
from climate.models import County
from common.cache import AgentCacheKey
from common.enums import Scenario

# Create your views here.


class ChatView(APIView):
    throttle_classes = [ChatAnonThrottle, ChatUserThrottle]

    def throttled(self, request, wait):
        if not request.user.is_authenticated:
            raise Throttled(wait, detail='Sign in to keep chatting with Boreas.')
        super().throttled(request, wait)

    @extend_schema(
        request=ChatSerializer,
        responses={
            HTTPStatus.OK: OpenApiResponse(
                description=(
                    'application/x-ndjson stream, one JSON event per line: '
                    '{"type": "tool", "name", "input"} while data is looked up, '
                    '{"type": "text", "text"} for each piece of the answer, '
                    '{"type": "done", "sources": [{"name", "url"}]} at the end, '
                    'or {"type": "error", "text"} if the answer could not be finished.'
                )
            ),
            HTTPStatus.BAD_REQUEST: OpenApiResponse(description='Invalid messages or context.'),
            HTTPStatus.TOO_MANY_REQUESTS: OpenApiResponse(description='Over the chat limit.'),
        },
    )
    def post(self, request):
        serializer = ChatSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        response = StreamingHttpResponse(
            stream_ask(data['messages'], data.get('context')), content_type='application/x-ndjson'
        )
        response['Cache-Control'] = 'no-cache'
        response['X-Accel-Buffering'] = 'no'
        return response


class CommentView(APIView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'commentary'

    def get(self, request, county, scenario):
        if scenario not in Scenario.values or scenario == Scenario.BASELINE:
            raise ValidationError({'scenario': [f'Unknown scenario: {scenario}.']})

        ck = AgentCacheKey.comment(county, scenario)
        data = cache.get(ck)
        if data is not None:
            return Response({'commentary': data}, status=HTTPStatus.OK)

        try:
            comment = generate_commentary(county, Scenario(scenario))
        except County.DoesNotExist:
            raise NotFound('Unknown county.')
        except anthropic.APIError:
            comment = None

        if comment is None:
            return Response({'detail': UNAVAILABLE}, status=HTTPStatus.SERVICE_UNAVAILABLE)

        data = comment.model_dump()
        cache.set(ck, data, AgentCacheKey.TIMEOUT)
        return Response({'commentary': data}, status=HTTPStatus.OK)
