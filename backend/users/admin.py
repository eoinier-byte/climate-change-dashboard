from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from users.models import User

# Register your models here.


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ('username', 'email', 'name', 'is_verified', 'is_staff')
    fieldsets = (
        BaseUserAdmin.fieldsets[0],
        ('Profile', {'fields': ('email', 'name', 'avatar', 'is_verified')}),
        *BaseUserAdmin.fieldsets[2:],
    )
