import copy
import io
import shutil
import tempfile
from pathlib import Path
from types import SimpleNamespace

from django.core.files.base import ContentFile
from django.test import TestCase, override_settings
from PIL import Image
from rest_framework.exceptions import ValidationError

from common.files import ValidateImageSize, delete_orphaned_files, resize_image
from users.models import User

MEDIA_ROOT = tempfile.mkdtemp()


def png_bytes(size=(300, 300), image_format='PNG'):
    buffer = io.BytesIO()
    Image.new('RGB', size, 'red').save(buffer, image_format)
    return buffer.getvalue()


def upload(size=(300, 300), file_size=None):
    """Mimics what DRF's ImageField hands to validators: the file size plus the opened Pillow image."""
    return SimpleNamespace(size=file_size or len(png_bytes(size)), image=Image.new('RGB', size))


class ValidateImageSizeTests(TestCase):
    validator = ValidateImageSize(max_size_mb=1, min_w=100, min_h=100)

    def test_accepts_image_within_limits(self):
        for size in ((100, 100), (4000, 3000)):
            with self.subTest(size=size):
                self.validator(upload(size))

    def test_rejects_file_over_size_limit(self):
        with self.assertRaises(ValidationError) as error:
            self.validator(upload(file_size=1024 * 1024 + 1))

        self.assertEqual(error.exception.detail[0].code, 'file_too_large')
        self.assertEqual(str(error.exception.detail[0]), 'The image must not be larger than 1 MB.')

    def test_rejects_too_small_resolution(self):
        for size in ((99, 100), (100, 99)):
            with self.subTest(size=size):
                with self.assertRaises(ValidationError) as error:
                    self.validator(upload(size))

                self.assertEqual(error.exception.detail[0].code, 'image_too_small')
                self.assertEqual(str(error.exception.detail[0]), 'The image must be at least 100x100 pixels.')

    def test_equality_by_limits(self):
        self.assertEqual(self.validator, ValidateImageSize(max_size_mb=1, min_w=100, min_h=100))
        self.assertNotEqual(self.validator, ValidateImageSize(max_size_mb=2, min_w=100, min_h=100))


@override_settings(MEDIA_ROOT=MEDIA_ROOT)
class ResizeImageTests(TestCase):
    resolution = (200, 200)

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(MEDIA_ROOT, ignore_errors=True)

    def setUp(self):
        self.user = User.objects.create_user(username='alice', email='alice@example.com', password='Str0ng-pass-123')

    def save_avatar(self, size=(300, 300), name='avatar.png', image_format='PNG'):
        self.user.avatar.save(name, ContentFile(png_bytes(size, image_format)), save=True)
        return self.user.avatar

    def stored_size(self, field_file):
        with Image.open(field_file.path) as image:
            return image.size

    def test_crops_larger_image_to_resolution(self):
        for size in ((300, 300), (800, 400), (200, 600)):
            with self.subTest(size=size):
                new = self.save_avatar(size)

                self.assertTrue(resize_image(self.resolution, new=new))
                self.assertEqual(self.stored_size(new), self.resolution)

    def test_converts_heif_to_jpeg_and_removes_original(self):
        new = self.save_avatar((300, 300), name='photo.heic', image_format='HEIF')
        heic_path = Path(new.path)

        self.assertTrue(resize_image(self.resolution, new=new))

        self.user.refresh_from_db()
        self.assertEqual(Path(self.user.avatar.name).suffix, '.jpg')
        with Image.open(self.user.avatar.path) as image:
            self.assertEqual((image.format, image.size), ('JPEG', self.resolution))
        self.assertFalse(heic_path.exists())

    def test_png_keeps_its_format(self):
        new = self.save_avatar((300, 300))

        resize_image(self.resolution, new=new)

        self.assertEqual(Path(new.name).suffix, '.png')
        with Image.open(new.path) as image:
            self.assertEqual(image.format, 'PNG')

    def test_leaves_smaller_image_untouched(self):
        new = self.save_avatar((150, 120))

        self.assertTrue(resize_image(self.resolution, new=new))
        self.assertEqual(self.stored_size(new), (150, 120))

    def test_deletes_replaced_file(self):
        # FieldFile.save() renames the same object in place, so keep a copy that still points at the old file.
        old = copy.copy(self.save_avatar(name='old.png'))
        old_path = Path(old.path)
        new = self.save_avatar(name='new.png')

        resize_image(self.resolution, new=new, old=old)

        self.assertFalse(old_path.exists())
        self.assertTrue(Path(new.path).exists())

    def test_same_file_is_not_touched(self):
        avatar = self.save_avatar()

        self.assertFalse(resize_image(self.resolution, new=avatar, old=avatar))
        self.assertTrue(Path(avatar.path).exists())
        self.assertEqual(self.stored_size(avatar), (300, 300))

    def test_removing_avatar_deletes_file(self):
        old = self.save_avatar()
        old_path = Path(old.path)

        self.assertFalse(resize_image(self.resolution, new=None, old=old))
        self.assertFalse(old_path.exists())

    def test_nothing_to_do(self):
        self.assertFalse(resize_image(self.resolution))


@override_settings(MEDIA_ROOT=MEDIA_ROOT)
class DeleteOrphanedFilesTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='alice', email='alice@example.com', password='Str0ng-pass-123')

    def test_removes_files_of_given_fields(self):
        self.user.avatar.save('avatar.png', ContentFile(png_bytes()), save=True)
        path = Path(self.user.avatar.path)

        delete_orphaned_files(self.user.avatar)

        self.assertFalse(path.exists())

    def test_ignores_empty_and_missing_files(self):
        self.user.avatar.save('avatar.png', ContentFile(png_bytes()), save=True)
        Path(self.user.avatar.path).unlink()
        empty = User.objects.create_user(username='bob', email='bob@example.com', password='Str0ng-pass-123')

        delete_orphaned_files(self.user.avatar, empty.avatar, None)
