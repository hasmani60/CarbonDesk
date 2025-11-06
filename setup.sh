#!/bin/bash

# ==========================================
# Carbon Accounting System - Setup Script
# ==========================================

set -e

echo "========================================"
echo "  Carbon Accounting System Setup"
echo "========================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
    echo -e "ℹ $1"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo "Checking prerequisites..."
echo ""

# Check Node.js
if command_exists node; then
    NODE_VERSION=$(node -v)
    print_success "Node.js installed: $NODE_VERSION"
else
    print_error "Node.js is not installed"
    echo "Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

# Check npm
if command_exists npm; then
    NPM_VERSION=$(npm -v)
    print_success "npm installed: $NPM_VERSION"
else
    print_error "npm is not installed"
    exit 1
fi

# Check for MongoDB
if command_exists mongosh || command_exists mongo; then
    print_success "MongoDB CLI tools found"
    HAS_MONGO_CLI=true
else
    print_warning "MongoDB CLI not found locally"
    print_info "You can use MongoDB Atlas instead"
    HAS_MONGO_CLI=false
fi

# Check for Docker
if command_exists docker; then
    print_success "Docker installed"
    HAS_DOCKER=true
else
    print_warning "Docker not found"
    HAS_DOCKER=false
fi

# Check for PM2
if command_exists pm2; then
    print_success "PM2 installed"
    HAS_PM2=true
else
    print_warning "PM2 not found"
    print_info "Install with: npm install -g pm2"
    HAS_PM2=false
fi

echo ""
echo "========================================"
echo "  Choose Deployment Method"
echo "========================================"
echo ""
echo "1) Docker (Recommended for production)"
echo "2) PM2 (Traditional deployment)"
echo "3) Development setup (no deployment)"
echo "4) Exit"
echo ""

read -p "Enter your choice [1-4]: " choice

case $choice in
    1)
        # Docker deployment
        echo ""
        echo "Setting up Docker deployment..."
        echo ""

        if ! $HAS_DOCKER; then
            print_error "Docker is required but not installed"
            echo "Install Docker from https://docs.docker.com/get-docker/"
            exit 1
        fi

        # Check for .env.production
        if [ ! -f "backend/.env.production" ]; then
            print_warning ".env.production not found"
            echo "Creating from example..."
            cp backend/.env.production.example backend/.env.production
            print_success "Created backend/.env.production"
            echo ""
            print_warning "IMPORTANT: Edit backend/.env.production and set:"
            echo "  - MONGODB_URI"
            echo "  - JWT_SECRET"
            echo "  - COMPANY_JWT_SECRET"
            echo "  - CLIENT_URL"
            echo ""
            read -p "Press Enter after editing .env.production..."
        fi

        # Start Docker Compose
        echo "Starting Docker services..."
        docker-compose up -d

        print_success "Docker services started!"
        echo ""
        echo "Services:"
        docker-compose ps
        echo ""

        print_info "View logs: docker-compose logs -f backend"
        print_info "Stop services: docker-compose down"
        print_info "Access application: http://localhost"
        print_info "Health check: http://localhost:5001/health"
        ;;

    2)
        # PM2 deployment
        echo ""
        echo "Setting up PM2 deployment..."
        echo ""

        if ! $HAS_PM2; then
            print_warning "PM2 is not installed"
            read -p "Install PM2 globally? (y/n): " install_pm2
            if [ "$install_pm2" = "y" ]; then
                sudo npm install -g pm2
                print_success "PM2 installed"
            else
                print_error "PM2 is required for this deployment method"
                exit 1
            fi
        fi

        # Install backend dependencies
        echo "Installing backend dependencies..."
        cd backend
        npm install --production
        print_success "Backend dependencies installed"

        # Install and build frontend
        echo "Installing frontend dependencies..."
        cd ../frontend
        npm install
        echo "Building frontend..."
        npm run build
        print_success "Frontend built"

        cd ..

        # Check for .env.production
        if [ ! -f "backend/.env.production" ]; then
            print_warning ".env.production not found"
            echo "Creating from example..."
            cp backend/.env.production.example backend/.env.production
            print_success "Created backend/.env.production"
            echo ""
            print_warning "IMPORTANT: Edit backend/.env.production and set:"
            echo "  - MONGODB_URI"
            echo "  - JWT_SECRET"
            echo "  - COMPANY_JWT_SECRET"
            echo ""
            read -p "Press Enter after editing .env.production..."
        fi

        # Start with PM2
        echo "Starting application with PM2..."
        pm2 start ecosystem.config.js --env production
        pm2 save

        print_success "Application started with PM2!"
        echo ""
        print_info "View logs: pm2 logs carbon-accounting-api"
        print_info "Monitor: pm2 monit"
        print_info "Status: pm2 status"
        print_info "Restart: pm2 restart carbon-accounting-api"
        print_info "Health check: curl http://localhost:5001/health"
        echo ""

        read -p "Configure PM2 to start on boot? (y/n): " setup_startup
        if [ "$setup_startup" = "y" ]; then
            pm2 startup
            print_info "Run the command shown above to complete startup configuration"
        fi
        ;;

    3)
        # Development setup
        echo ""
        echo "Setting up development environment..."
        echo ""

        # Install backend dependencies
        echo "Installing backend dependencies..."
        cd backend
        npm install
        print_success "Backend dependencies installed"

        # Install frontend dependencies
        echo "Installing frontend dependencies..."
        cd ../frontend
        npm install
        print_success "Frontend dependencies installed"

        cd ..

        # Create .env if not exists
        if [ ! -f "backend/.env" ]; then
            print_warning "backend/.env not found"
            echo "Creating from example..."
            if [ -f "backend/.env.example" ]; then
                cp backend/.env.example backend/.env
            else
                cat > backend/.env << 'EOF'
NODE_ENV=development
PORT=5001
MONGODB_URI=mongodb://localhost:27017/carbon_accounting_dev
JWT_SECRET=development-jwt-secret-change-in-production
COMPANY_JWT_SECRET=development-company-jwt-secret
CLIENT_URL=http://localhost:5173
EOF
            fi
            print_success "Created backend/.env"
        fi

        echo ""
        print_success "Development setup complete!"
        echo ""
        echo "To start development:"
        echo "  Terminal 1: cd backend && npm run dev"
        echo "  Terminal 2: cd frontend && npm run dev"
        echo ""

        if $HAS_DOCKER; then
            echo "Or use Docker for MongoDB:"
            echo "  docker-compose -f docker-compose.dev.yml up -d"
            echo "  Access Mongo Express: http://localhost:8081 (admin/admin)"
            echo ""
        fi

        print_info "Frontend will be at: http://localhost:5173"
        print_info "Backend will be at: http://localhost:5001"
        ;;

    4)
        echo "Exiting..."
        exit 0
        ;;

    *)
        print_error "Invalid choice"
        exit 1
        ;;
esac

echo ""
echo "========================================"
echo "  Setup Complete!"
echo "========================================"
echo ""
echo "Default credentials:"
echo "  Email: demo@example.com"
echo "  Password: password123"
echo ""
print_warning "IMPORTANT: Change default passwords in production!"
echo ""
echo "For more information:"
echo "  - Quick Start: QUICK_START.md"
echo "  - Full Deployment Guide: DEPLOYMENT.md"
echo "  - Project Overview: README.md"
echo ""
