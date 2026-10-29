from django.contrib import admin

from climate.models import ClimateProjection, County, DataSource, SeaLevelProjection

# Register your models here.


@admin.register(County)
class CountyAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'has_coastline')
    prepopulated_fields = {'slug': ('name',)}


@admin.register(DataSource)
class DataSourceAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'baseline_period', 'accessed_on')


@admin.register(ClimateProjection)
class ClimateProjectionAdmin(admin.ModelAdmin):
    list_display = ('county', 'variable', 'scenario', 'period', 'season', 'value', 'unit')
    list_filter = ('variable', 'scenario', 'period', 'season')
    list_select_related = ('county',)


@admin.register(SeaLevelProjection)
class SeaLevelProjectionAdmin(admin.ModelAdmin):
    list_display = ('county', 'scenario', 'year', 'value', 'unit', 'provenance')
    list_filter = ('scenario', 'year')
    list_select_related = ('county',)
