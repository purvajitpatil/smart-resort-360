# Smart Resort 360 backend image.
# Build context MUST be the repository root (compose does this automatically).
FROM python:3.13-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app ./app
COPY data/pois ./data/pois

ENV SEED_DATA_FILE=/app/data/pois/jaipur.json \
    SEED_ON_STARTUP=true

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]