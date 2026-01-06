#!/bin/bash

set -e

RED="\033[0;31m"
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
BLUE="\033[0;34m"
NC="\033[0m"

if [ -f .env ]; then
    export $(grep -v '^#' .env | grep -v '^[[:space:]]*$' | xargs)
fi

NODE_ENV=${NODE_ENV:-development}

if [ "$NODE_ENV" = "production" ]; then
    COMPOSE_FILE="docker-compose.production.yml"
    OTHER_COMPOSE_FILE="docker-compose.development.yml"
else
    COMPOSE_FILE="docker-compose.development.yml"
    OTHER_COMPOSE_FILE="docker-compose.production.yml"
fi

print_step() {
    echo ""
    echo -e "${BLUE}===================================================${NC}"
    echo -e "${YELLOW}$1${NC}"
    echo -e "${BLUE}===================================================${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

export CACHEBUST=$(date +%s)

print_step "Starting Deployment"
print_info "CACHEBUST: $CACHEBUST"
print_info "NODE_ENV: ${NODE_ENV:-development}"
print_info "Compose file: $COMPOSE_FILE"
print_info "Timestamp: $(date "+%Y-%m-%d %H:%M:%S")"

print_step "Current Docker Disk Usage"
sudo docker system df

print_step "Stopping All Containers (Both Environments)"

print_info "Stopping $NODE_ENV containers..."
if sudo docker compose -f $COMPOSE_FILE down; then
    print_success "$NODE_ENV containers stopped"
else
    print_info "No $NODE_ENV containers running"
fi

print_info "Stopping other environment containers..."
if sudo docker compose -f $OTHER_COMPOSE_FILE down; then
    print_success "Other environment containers stopped"
else
    print_info "No other environment containers running"
fi

print_step "Removing Old Project Images"
OLD_IMAGES=$(sudo docker images | grep "managementapplication" | wc -l)
if [ $OLD_IMAGES -gt 0 ]; then
    print_info "Found $OLD_IMAGES old images"
    sudo docker images | grep "managementapplication" | awk '{print $3}' | xargs -r sudo docker rmi -f || true
    print_success "Old images removed"
else
    print_info "No old images to remove"
fi

print_step "Building Images"
if sudo CACHEBUST=$CACHEBUST docker compose -f $COMPOSE_FILE build; then
    print_success "Images built successfully"
else
    print_error "Build failed"
    exit 1
fi

print_step "Cleaning Up Docker Resources"
print_info "Removing dangling images..."
sudo docker image prune -f
print_info "Removing stopped containers..."
sudo docker container prune -f
print_info "Removing unused networks..."
sudo docker network prune -f
print_success "Cleanup completed"

print_step "New Docker Disk Usage"
sudo docker system df

print_step "Starting Containers"
if sudo docker compose -f $COMPOSE_FILE up -d; then
    print_success "Containers started successfully"
else
    print_error "Failed to start containers"
    exit 1
fi

print_step "Waiting for Containers to be Ready"
sleep 3

print_step "Container Status"
sudo docker compose -f $COMPOSE_FILE ps

RUNNING_COUNT=$(sudo docker compose -f $COMPOSE_FILE ps --format json 2>/dev/null | grep -c '"State":"running"' || echo "0")
TOTAL_COUNT=$(sudo docker compose -f $COMPOSE_FILE ps --format json 2>/dev/null | wc -l || echo "0")

if [ "$RUNNING_COUNT" -eq "$TOTAL_COUNT" ] && [ "$TOTAL_COUNT" -gt 0 ]; then
    print_success "All $TOTAL_COUNT containers are running"
else
    print_error "Only $RUNNING_COUNT/$TOTAL_COUNT containers are running"
    print_info "Check logs for errors"
fi

print_step "Deployment Summary"
echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo -e "${BLUE}ℹ️  CACHEBUST: $CACHEBUST${NC}"
echo -e "${BLUE}ℹ️  NODE_ENV: ${NODE_ENV:-development}${NC}"
echo -e "${BLUE}ℹ️  Time: $(date "+%Y-%m-%d %H:%M:%S")${NC}"
echo ""
echo -e "${YELLOW}📋 View logs: sudo docker compose -f $COMPOSE_FILE logs -f${NC}"
echo -e "${YELLOW}📊 Check status: sudo docker compose -f $COMPOSE_FILE ps${NC}"
echo -e "${YELLOW}⏹️  Stop: sudo docker compose -f $COMPOSE_FILE down${NC}"
echo ""