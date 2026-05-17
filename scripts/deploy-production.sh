#!/bin/bash

# Production Deployment Validation Script
# This script validates the production deployment of HYPEBOTX

set -e

echo "🚀 Starting HYPEBOTX Production Deployment Validation"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print status
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed"
    exit 1
fi

if ! docker compose version &> /dev/null; then
    print_error "Docker Compose plugin is not installed"
    exit 1
fi

print_status "Docker and Docker Compose are available"

# Check if .env file exists
if [ ! -f ".env" ]; then
    print_error ".env file not found"
    exit 1
fi

print_status ".env file exists"

# Validate environment variables
required_vars=("DISCORD_TOKEN" "CLIENT_ID" "GUILD_ID")
for var in "${required_vars[@]}"; do
    if ! grep -q "^${var}=" .env; then
        print_error "Required environment variable ${var} not found in .env"
        exit 1
    fi
done

print_status "Required environment variables are set"

# Build the application
echo "Building Docker image..."
docker compose -f infra/compose/docker-compose.yml build

print_status "Docker image built successfully"

# Start services
echo "Starting services..."
docker compose -f infra/compose/docker-compose.yml up -d

print_status "Services started"

# Wait for services to be healthy
echo "Waiting for services to be healthy..."
sleep 30

# Check if services are running
if ! docker compose -f infra/compose/docker-compose.yml ps | grep -q "Up"; then
    print_error "Services failed to start"
    docker compose -f infra/compose/docker-compose.yml logs
    exit 1
fi

print_status "Services are running"

# Check health endpoint
echo "Checking health endpoint..."
if curl -f http://localhost:8787/health &> /dev/null; then
    print_status "Health check passed"
else
    print_error "Health check failed"
    docker compose -f infra/compose/docker-compose.yml logs bot
    exit 1
fi

# Run smoke tests
echo "Running smoke tests..."
if docker compose -f infra/compose/docker-compose.yml exec -T bot npm run test:bot; then
    print_status "Smoke tests passed"
else
    print_error "Smoke tests failed"
    docker compose -f infra/compose/docker-compose.yml logs bot
    exit 1
fi

# Check database connectivity
echo "Checking database connectivity..."
if docker compose -f infra/compose/docker-compose.yml exec -T bot node -e "
const { createDatabase } = require('./apps/bot/src/database/connection');
const logger = { info(){}, warn(){}, error(){} };
const db = createDatabase({ storage: { root: './apps/bot/src/storage' } }, logger);
db.init();
console.log('Database initialized successfully');
"; then
    print_status "Database connectivity verified"
else
    print_error "Database connectivity failed"
    exit 1
fi

# Validate Discord connection (this would require actual token)
echo "Note: Discord connection validation requires valid bot token"
print_warning "Please manually verify Discord bot connection after deployment"

echo ""
print_status "🎉 Production deployment validation completed successfully!"
echo ""
echo "Next steps:"
echo "1. Monitor logs: docker compose -f infra/compose/docker-compose.yml logs -f bot"
echo "2. Check dashboard: http://localhost:8787"
echo "3. Verify Discord bot is online"
echo "4. Run full QA suite: docker compose -f infra/compose/docker-compose.yml exec bot npm run qa:all --workspace=apps/bot"
