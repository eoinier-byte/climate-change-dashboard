from rest_framework.throttling import AnonRateThrottle, UserRateThrottle


class ChatAnonThrottle(AnonRateThrottle):
    scope = 'chat_anon'


class ChatUserThrottle(UserRateThrottle):
    throttle_classes = [ChatAnonThrottle]
    scope = 'chat_user'

    def get_cache_key(self, request, view):
        if not request.user.is_authenticated:
            return None
        return super().get_cache_key(request, view)
