from django.apps import AppConfig


class ReputacaoConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'reputacao'

    def ready(self):
        import reputacao.signals  # noqa: F401
