from django.db import models

# Create your models here.


class County(models.Model):
    name = models.CharField(max_length=100, unique=True, null=False, blank=False)

    def __str__(self):
        return self.name
