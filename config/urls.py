from django.contrib import admin
from django.urls import path, include


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('autenticacao.api.urls')),
    path('api/forum/', include('forum.api.urls')),
]