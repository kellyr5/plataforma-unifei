from django.apps import AppConfig


class VoluntariadoConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'voluntariado'

    def ready(self):
        import voluntariado.signals  # noqa: F401
