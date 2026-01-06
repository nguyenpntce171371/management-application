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

if [ "$NODE_ENV" = "production" ]; then
    print_step "Building Frontend for Production"
    cd ./frontend
    
    print_info "Cleaning ALL caches and old build..."
    rm -rf dist
    rm -rf node_modules
    rm -rf .vite
    rm -rf node_modules/.cache
    
    print_info "Installing fresh dependencies (including devDependencies)..."
    if NODE_ENV=development npm install; then
        print_success "Dependencies installed"
    else
        print_error "Failed to install dependencies"
        exit 1
    fi
    
    print_info "Building fresh production bundle..."
    if npm run build; then
        print_success "Frontend build completed!"
        if [ -d "dist" ] && [ -f "dist/index.html" ]; then
            print_info "Built files:"
            ls -lah dist/assets/ | grep "index-" || ls -lah dist/assets/ | head -5
            
            INDEX_FILE=$(ls dist/assets/index-*.js 2>/dev/null | head -1)
            if [ -n "$INDEX_FILE" ]; then
                print_info "New JS file: $(basename $INDEX_FILE)"
            fi
        else
            print_error "Build output is incomplete"
            exit 1
        fi
    else
        print_error "Frontend build failed"
        exit 1
    fi
    
    cd -
fi

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

if [ "$NODE_ENV" = "production" ]; then
    print_step "Cleaning Frontend Volume"
    print_info "Removing old frontend_dist volume..."
    sudo docker volume rm managementapplication_frontend_dist 2>/dev/null || print_info "Volume doesn't exist or already removed"
    print_success "Frontend volume cleaned"
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
sleep 5

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

if [ "$NODE_ENV" = "production" ]; then
    print_step "Verifying Frontend Deployment"
    print_info "Checking deployed files..."
    sleep 3
    
    print_info "Files in volume:"
    sudo docker exec caddy ls -lah /srv/frontend/assets/ 2>/dev/null || print_info "Files still being copied..."
    
    print_info "Files on host:"
    ls -lah ./frontend/dist/assets/index-*.js 2>/dev/null || echo "No index files found"
    
    print_info "Frontend container logs:"
    sudo docker logs frontend 2>/dev/null | tail -10 || echo "No logs yet"
fi

print_step "Deployment Summary"
echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo -e "${BLUE}ℹ️  CACHEBUST: $CACHEBUST${NC}"
echo -e "${BLUE}ℹ️  NODE_ENV: ${NODE_ENV:-development}${NC}"
echo -e "${BLUE}ℹ️  Time: $(date "+%Y-%m-%d %H:%M:%S")${NC}"
echo ""
if [ "$NODE_ENV" = "production" ]; then
    echo -e "${YELLOW}⚠️  IMPORTANT: Hard refresh your browser (Ctrl+Shift+R) to load new code!${NC}"
    echo ""
fi
echo -e "${YELLOW}📋 View logs: sudo docker compose -f $COMPOSE_FILE logs -f${NC}"
echo -e "${YELLOW}📊 Check status: sudo docker compose -f $COMPOSE_FILE ps${NC}"
echo -e "${YELLOW}⏹️  Stop: sudo docker compose -f $COMPOSE_FILE down${NC}"
echo ""