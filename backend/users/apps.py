from django.apps import AppConfig

class UsersConfig(AppConfig):
    """
    Application configuration for the 'users' Django app.
    """
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'users'

    def ready(self):
        """
        Import signals when the app is ready to ensure they are registered.
        """
        import users.signals