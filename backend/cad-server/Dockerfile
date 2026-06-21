FROM python:3.12-slim

# ── OpenGL lib for CadQuery's OCC backend ──
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    && rm -rf /var/lib/apt/lists/*

# ── Python deps (cached layer — only reinstalls when requirements.txt changes) ──
COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

# ── Create non-root sandbox user ──
RUN adduser --disabled-password --gecos "" --uid 1000 sandbox

# ── App directory ──
WORKDIR /app

# ── Copy source modules (this layer changes most often, so it's last) ──
COPY src/runner.py src/inspector.py src/snapshot.py \
     src/png_snapshot.py src/dim_views.py /app/

# ── Ensure writable /work and /tmp for sandbox user ──
RUN mkdir -p /work /tmp && chown sandbox:sandbox /work /tmp

USER sandbox

CMD ["python", "/app/runner.py"]
