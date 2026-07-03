# syntax=docker/dockerfile:1.7

# ########## STAGE 1: Builder (Heavy Lifting) ##########
FROM public.ecr.aws/docker/library/python:3.12-slim AS builder

WORKDIR /app

# Set PATH to include user-installed binaries/libs immediately
ENV PATH=/root/.local/bin:$PATH
ENV PIP_DEFAULT_TIMEOUT=1200

# Install build dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    git \
    && rm -rf /var/lib/apt/lists/*

# 3. NOW copy requirements and install the rest.
# Even if requirements.txt changes, the layers above (Model Download) remain cached.
COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --user -r requirements.txt


# ########## STAGE 2: Final (Lightweight Runtime) ##########
FROM public.ecr.aws/docker/library/python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PATH=/root/.local/bin:$PATH

WORKDIR /app

RUN apt-get update && apt-get install -y \
    libpq-dev \
    netcat-traditional \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy installed Python packages
COPY --from=builder /root/.local /root/.local

# Copy project files (Always changes last)
COPY . /app/

RUN chmod +x /app/start.sh

CMD ["/app/start.sh"]
