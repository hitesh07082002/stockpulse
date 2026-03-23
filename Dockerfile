FROM node:22-alpine AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build


FROM python:3.13-slim-bookworm AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DJANGO_SETTINGS_MODULE=config.settings \
    SPA_BUILD_DIR=/app/frontend_dist

WORKDIR /app/backend

RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq-dev \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd --system app && useradd --system --create-home --gid app app

COPY backend/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

COPY backend/ /app/backend/
COPY --from=frontend-builder /app/frontend/dist /app/frontend_dist

RUN SECRET_KEY=build-placeholder DEBUG=False python manage.py collectstatic --noinput \
    && chown -R app:app /app

USER app

EXPOSE 8000

CMD ["gunicorn", "-c", "gunicorn.conf.py", "config.wsgi:application"]
