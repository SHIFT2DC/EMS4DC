FROM python:3.12-slim

WORKDIR /app

# Install system dependencies (adjust if your packages need build tools)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all source code
COPY . .

# Default command — overridden by each service in docker-compose.yml
CMD ["python", "optimizer.py"]