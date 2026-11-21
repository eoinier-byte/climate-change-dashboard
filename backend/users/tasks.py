from celery import shared_task

from common.utils import send_email


@shared_task
def async_send_email(user_id: int, email_type: str) -> None:
    send_email(user_id, email_type)
