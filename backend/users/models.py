from django.contrib.auth.models import AbstractUser
from django.db import models

# Create your models here.


class User(AbstractUser):
    email = models.EmailField(unique=True, null=True)
    name = models.CharField(max_length=50, blank=True, null=True)
    avatar = models.ImageField(upload_to='users', blank=True, null=True)
    is_verified = models.BooleanField(default=False)

    first_name = None
    last_name = None

    def __str__(self):
        return f'{self.id}-{self.username}'
