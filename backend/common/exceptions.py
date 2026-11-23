from http import HTTPStatus

from rest_framework.exceptions import APIException


class Gone(APIException):
    status_code = HTTPStatus.GONE
    default_detail = 'Link is no longer valid.'
