from django.db import transaction
from django.db.models.signals import post_delete
from django.dispatch import receiver

from common.files import delete_orphaned_files
from users.models import User


@receiver(post_delete, sender=User)
def user_delete(sender, instance, **kwargs):
    avatar = instance.avatar
    transaction.on_commit(lambda: delete_orphaned_files(avatar))
