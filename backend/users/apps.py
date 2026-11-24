from django.apps import AppConfig


class UsersConfig(AppConfig):
    name = 'users'

    def ready(self):
        from pillow_heif import register_heif_opener

        register_heif_opener()
