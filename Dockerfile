FROM python:3.11-slim

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .

# Writable at runtime; mount a Railway volume at /app/data for persistence.
RUN mkdir -p data/chroma

EXPOSE 8000

# --proxy-headers + --forwarded-allow-ips lets uvicorn trust Railway's single
# edge proxy, so request.client.host (and thus rate limiting / lockout) keys on
# the real client IP from X-Forwarded-For instead of the proxy's IP.
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*'
