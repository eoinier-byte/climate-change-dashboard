from decimal import Decimal

from rest_framework import serializers

from climate.models import ClimateProjection
from climate.serializers import CountySerializer
from common.utils import change_from_baseline


class RankItemSerializer(serializers.ModelSerializer):
    county = CountySerializer()
    change = serializers.SerializerMethodField()
    baseline_value = serializers.DecimalField(max_digits=8, decimal_places=3, read_only=True)

    @staticmethod
    def get_change(obj) -> Decimal | None:
        if obj.baseline_value is None:
            return None
        return change_from_baseline(obj.value, obj.baseline_value, obj.variable)

    class Meta:
        model = ClimateProjection
        fields = ('county', 'value', 'baseline_value', 'change')


class RankSerializer(serializers.Serializer):
    variable = serializers.CharField()
    season = serializers.CharField()
    scenario = serializers.CharField()
    period = serializers.CharField()
    unit = serializers.CharField(allow_null=True)
    change_unit = serializers.CharField(allow_null=True)
    baseline_period = serializers.CharField(allow_null=True)
    source = serializers.CharField(allow_null=True)
    results = serializers.SerializerMethodField()

    def get_results(self, obj) -> list[dict]:
        items = RankItemSerializer(obj['results'], many=True).data
        items = sorted(items, key=lambda item: item['change'], reverse=not self.context['asc'])
        return items[: self.context['limit']] if self.context['limit'] > 0 else items


class ChatMessageSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=['user', 'assistant'])
    content = serializers.CharField(max_length=500, trim_whitespace=True)


class ChatSerializer(serializers.Serializer):
    messages = ChatMessageSerializer(many=True, allow_empty=False, max_length=20)

    def validate_messages(self, messages):
        if messages[-1]['role'] != 'user':
            raise serializers.ValidationError('The last message must be from the user.')
        return messages
