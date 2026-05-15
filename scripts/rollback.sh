#!/bin/bash

# Rollback Strategy for HYPEBOTX Production Deployment

set -e

echo "🔄 Starting HYPEBOTX Rollback Procedure"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Function to backup current state
backup_current_state() {
    print_info "Creating pre-rollback backup..."
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_DIR="./backups/rollback_$TIMESTAMP"

    mkdir -p "$BACKUP_DIR"

    # Backup database
    if [ -f "./storage/database.db" ]; then
        cp "./storage/database.db" "$BACKUP_DIR/database.db"
        print_status "Database backed up"
    fi

    # Backup logs
    cp -r "./logs" "$BACKUP_DIR/logs" 2>/dev/null || true
    print_status "Logs backed up"

    # Backup environment
    cp ".env" "$BACKUP_DIR/.env" 2>/dev/null || true
    print_status "Environment backed up"

    echo "$BACKUP_DIR" > "./rollback_backup_path.txt"
    print_status "Rollback backup created at $BACKUP_DIR"
}

# Function to stop services
stop_services() {
    print_info "Stopping current services..."
    docker-compose down
    print_status "Services stopped"
}

# Function to restore from backup
restore_from_backup() {
    local backup_path="$1"

    if [ ! -d "$backup_path" ]; then
        print_error "Backup path $backup_path does not exist"
        exit 1
    fi

    print_info "Restoring from backup: $backup_path"

    # Restore database
    if [ -f "$backup_path/database.db" ]; then
        cp "$backup_path/database.db" "./storage/database.db"
        print_status "Database restored"
    fi

    # Restore environment if needed
    if [ -f "$backup_path/.env" ]; then
        cp "$backup_path/.env" ".env"
        print_status "Environment restored"
    fi
}

# Function to start services
start_services() {
    print_info "Starting services with previous version..."
    docker-compose up -d
    print_status "Services started"

    # Wait for health check
    print_info "Waiting for services to be healthy..."
    sleep 30

    # Check health
    if curl -f http://localhost:8787/health &> /dev/null; then
        print_status "Health check passed"
    else
        print_warning "Health check failed - manual verification required"
    fi
}

# Main rollback logic
main() {
    echo "Available rollback options:"
    echo "1. Rollback to previous deployment"
    echo "2. Restore from specific backup"
    echo "3. Emergency stop (stop services only)"
    echo ""

    read -p "Select rollback option (1-3): " option

    case $option in
        1)
            print_info "Performing standard rollback to previous deployment"

            # Create backup of current state
            backup_current_state

            # Stop services
            stop_services

            # Pull previous image (if using tags)
            print_info "Pulling previous stable image..."
            docker-compose pull

            # Start services
            start_services

            print_status "Rollback completed successfully"
            ;;

        2)
            print_info "Restoring from specific backup"

            # List available backups
            echo "Available backups:"
            ls -la ./backups/ | grep rollback

            read -p "Enter backup directory name: " backup_name
            backup_path="./backups/$backup_name"

            if [ ! -d "$backup_path" ]; then
                print_error "Backup $backup_path not found"
                exit 1
            fi

            # Create backup of current state
            backup_current_state

            # Stop services
            stop_services

            # Restore from backup
            restore_from_backup "$backup_path"

            # Start services
            start_services

            print_status "Backup restoration completed"
            ;;

        3)
            print_info "Emergency stop - stopping all services"
            docker-compose down
            print_status "All services stopped"
            print_warning "Services have been stopped. Manual restart required."
            ;;

        *)
            print_error "Invalid option selected"
            exit 1
            ;;
    esac

    echo ""
    print_info "Rollback procedure completed"
    print_info "Monitor the application and verify functionality"
    print_info "Check logs: docker-compose logs -f hypebotx"
}

# Run main function
main "$@"