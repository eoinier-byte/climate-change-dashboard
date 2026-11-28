from django.urls import path

from ai_agent.views import ChatView, CommentView

app_name = 'ai_agent'


urlpatterns = [
    path('chat/', ChatView.as_view(), name='chat'),
    path('commentary/<slug:county>/<str:scenario>/', CommentView.as_view(), name='commentary'),
]
