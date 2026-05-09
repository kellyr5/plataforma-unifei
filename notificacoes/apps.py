from django.apps import AppConfig


class NotificacoesConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'notificacoes'

    def ready(self):
        """Importa os signals para que sejam registrados na inicializacao."""
        import notificacoes.signals  # noqa: F401
