FROM python:3.14-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends gcc libpq-dev \
    && rm -rf /var/lib/apt/lists/*

RUN useradd -m app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY .. .

RUN mkdir -p /app/media && chown -R app:app /app/media

USER app
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3"]