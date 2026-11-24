from django.apps import AppConfig


class UsersConfig(AppConfig):
    name = 'users'

    def ready(self):
        from pillow_heif import register_heif_opener

        from users import signals  # noqa: F401

        register_heif_opener()
