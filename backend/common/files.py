import io
import os
from pathlib import Path

from django.core.files.base import ContentFile
from django.db.models.fields.files import FieldFile, ImageFieldFile
from django.utils.deconstruct import deconstructible
from PIL import Image, ImageOps
from rest_framework.exceptions import ValidationError


@deconstructible
class ValidateImageSize:
    def __init__(self, max_size_mb: float, min_w: int, min_h: int):
        self.max_size_mb = max_size_mb
        self.min_w = min_w
        self.min_h = min_h

    def __call__(self, image):
        max_bytes = self.max_size_mb * 1024 * 1024
        if image.size > max_bytes:
            raise ValidationError(
                f'The image must not be larger than {self.max_size_mb} MB.',
                code='file_too_large',
            )

        width, height = image.image.size
        if width < self.min_w or height < self.min_h:
            raise ValidationError(
                f'The image must be at least {self.min_w}x{self.min_h} pixels.',
                code='image_too_small',
            )

    def __eq__(self, other):
        return isinstance(other, ValidateImageSize) and (self.max_size_mb, self.min_w, self.min_h) == (
            other.max_size_mb,
            other.min_w,
            other.min_h,
        )


BROWSER_IMAGE_FORMATS = {'JPEG', 'PNG'}


def _replace_with_jpeg(field_file: ImageFieldFile, image: Image.Image) -> None:
    buffer = io.BytesIO()
    image.convert('RGB').save(buffer, 'JPEG', quality=90)

    old_name = field_file.name
    field_file.save(Path(old_name).with_suffix('.jpg').name, ContentFile(buffer.getvalue()), save=False)
    field_file.instance.save(update_fields=[field_file.field.attname])
    field_file.storage.delete(old_name)


def resize_image(
    resolution: tuple[int, int], new: ImageFieldFile | None = None, old: ImageFieldFile | None = None
) -> bool:
    if new and new != old:
        if old:
            old.delete(save=False)

        with Image.open(new.path) as original:
            image_format = original.format
            original.load()
            image = original.copy()

        width, height = resolution
        resized = image.size[0] > width or image.size[1] > height
        if resized:
            image = ImageOps.fit(image, resolution, centering=(0.5, 0.5))

        if image_format not in BROWSER_IMAGE_FORMATS:
            _replace_with_jpeg(new, image)
        elif resized:
            image.save(new.path, image_format)
        return True
    elif old and not new:
        old.delete()
        return False
    return False


def delete_orphaned_files(*files: FieldFile | None) -> None:
    for file in files:
        if not file:
            continue
        try:
            os.remove(file.path)
        except OSError:
            pass
