#!/bin/bash
# Migration Setup Script for Carbon Track
# This script automates the initial setup steps

set -e  # Exit on any error

echo "═══════════════════════════════════════════════════"
echo "  Carbon Track - MongoDB Migration Setup"
echo "═══════════════════════════════════════════════════"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

# Check if we're in the right directory
if [ ! -d "backend" ]; then
    print_error "Error: backend directory not found. Please run this script from the project root."
    exit 1
fi

echo "Step 1: Creating backup directory..."
mkdir -p backend/database/backups
print_success "Backup directory created"

echo ""
echo "Step 2: Backing up SQLite database..."
if [ -f "backend/database/carbon_accounting.db" ]; then
    BACKUP_NAME="carbon_accounting_$(date +%Y%m%d_%H%M%S).db"
    cp backend/database/carbon_accounting.db "backend/database/backups/$BACKUP_NAME"
    print_success "Database backed up to: backend/database/backups/$BACKUP_NAME"
else
    print_info "No SQLite database found to backup (this is ok for new installations)"
fi

echo ""
echo "Step 3: Installing MongoDB dependencies..."
cd backend
npm install mongoose
print_success "Mongoose installed"
cd ..

echo ""
echo "Step 4: Creating models directory..."
mkdir -p backend/models
print_success "Models directory created"

echo ""
echo "Step 5: Checking environment configuration..."
if [ ! -f "backend/.env" ]; then
    print_error "backend/.env file not found!"
    echo ""
    echo "Please create backend/.env with the following content:"
    echo ""
    echo "MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/carbon_accounting?retryWrites=true&w=majority"
    echo ""
    exit 1
fi

if grep -q "MONGODB_URI" backend/.env; then
    print_success "MONGODB_URI found in .env"
else
    print_error "MONGODB_URI not found in .env"
    echo ""
    echo "Please add the following line to backend/.env:"
    echo "MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/carbon_accounting?retryWrites=true&w=majority"
    echo ""
    exit 1
fi

echo ""
echo "Step 6: Counting SQLite records..."
if [ -f "backend/database/carbon_accounting.db" ]; then
    echo "Current database contents:"
    sqlite3 backend/database/carbon_accounting.db << 'EOF'
.mode column
.headers on
SELECT 'organisations' as table_name, COUNT(*) as count FROM organisations
UNION ALL
SELECT 'users', COUNT(*) FROM users
UNION ALL
SELECT 'emissions', COUNT(*) FROM emissions
UNION ALL
SELECT 'tasks', COUNT(*) FROM tasks
UNION ALL
SELECT 'company_operators', COUNT(*) FROM company_operators;
.quit
EOF
    print_success "Record counts displayed"
else
    print_info "No SQLite database to count"
fi

echo ""
echo "═══════════════════════════════════════════════════"
echo "  Setup Complete!"
echo "═══════════════════════════════════════════════════"
echo ""
echo "Next steps:"
echo "1. Copy the MongoDB model files to backend/models/"
echo "2. Review MIGRATION_GUIDE.md for detailed instructions"
echo "3. Test MongoDB connection:"
echo "   node backend/test-mongodb-connection.js"
echo "4. Run migration:"
echo "   node backend/scripts/migrate-to-mongodb.js"
echo ""
