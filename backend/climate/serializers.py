from rest_framework import serializers

from climate.models import County


class CountySerializer(serializers.ModelSerializer):
    class Meta:
        model = County
        fields = ('id', 'name', 'slug', 'has_coastline')
