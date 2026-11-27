from django.urls import path

from ai_agent.views import ChatView

app_name = 'ai_agent'


urlpatterns = [
    path('chat/', ChatView.as_view(), name='chat'),
]
