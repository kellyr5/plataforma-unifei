from django.apps import AppConfig


class BuscaConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'busca'
    verbose_name = 'Busca semantica'

    def ready(self):
        # Importa os sinais que mantem o indice acompanhando o forum.
        from busca import signals  # noqa: F401
