from django.urls import path

from busca.api.views import BuscaForumView


urlpatterns = [
    path('', BuscaForumView.as_view(), name='busca-forum'),
]
