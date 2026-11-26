from django.http import StreamingHttpResponse
from rest_framework.exceptions import Throttled
from rest_framework.views import APIView

from ai_agent.agent import stream_ask
from ai_agent.serializers import ChatSerializer
from ai_agent.throttless import ChatAnonThrottle, ChatUserThrottle

# Create your views here.


class ChatView(APIView):
    throttle_classes = [ChatAnonThrottle, ChatUserThrottle]

    def throttled(self, request, wait):
        if not request.user.is_authenticated:
            raise Throttled(wait, detail='Sign in to keep chatting with Boreas.')
        super().throttled(request, wait)

    def post(self, request):
        serializer = ChatSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        response = StreamingHttpResponse(
            stream_ask(serializer.validated_data['messages']), content_type='text/plain; charset=utf-8'
        )
        response['Cache-Control'] = 'no-cache'
        response['X-Accel-Buffering'] = 'no'
        return response
