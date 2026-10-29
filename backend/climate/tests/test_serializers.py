from climate.tests.base import ProjectionTestCase
from common.serializers import ProvenanceMixin


class ProvenanceMixinTestCase(ProjectionTestCase):
    def test_climate_projection(self):
        data = ProvenanceMixin(self.create_climate_projection()).data
        self.assertEqual(
            data,
            {'scenario': 'rcp45', 'baseline': '1976-2005', 'units': 'degC', 'source': 'translate'},
        )

    def test_sea_level_projection(self):
        data = ProvenanceMixin(self.create_sea_level_projection()).data
        self.assertEqual(
            data,
            {'scenario': 'rcp85', 'baseline': '1981-2000', 'units': 'cm', 'source': 'ukcp18'},
        )
