#!/bin/bash
# Test script for Cisco Terminal SSH implementation

set -e

echo "============================================"
echo "🧪 Cisco Terminal SSH - Testing Suite"
echo "============================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counters
PASS=0
FAIL=0

# Helper functions
log_pass() {
  echo -e "${GREEN}✓ PASS:${NC} $1"
  ((PASS++))
}

log_fail() {
  echo -e "${RED}✗ FAIL:${NC} $1"
  ((FAIL++))
}

log_info() {
  echo -e "${YELLOW}ℹ INFO:${NC} $1"
}

# Test 1: Check backend is running
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 1: Backend Service"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if curl -s http://localhost:8000/health > /dev/null 2>&1; then
  log_pass "Backend API responding on port 8000"
else
  log_fail "Backend API not responding on port 8000"
fi

# Test 2: Check cisco router module is loaded
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 2: Cisco Router Module"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if curl -s -u onos:rocks http://localhost:8000/api/cisco/health/check > /dev/null 2>&1; then
  log_pass "Cisco router endpoints are accessible"
else
  log_fail "Cisco router endpoints not responding"
fi

# Test 3: Check frontend is running
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 3: Frontend Service"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if curl -s http://localhost:3000 > /dev/null 2>&1; then
  log_pass "Frontend serving on port 3000"
else
  log_fail "Frontend not responding on port 3000"
fi

# Test 4: Check frontend terminal page
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 4: Terminal Page Route"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

response=$(curl -s -w "\n%{http_code}" http://localhost:3000/dashboard/cisco/terminal)
status_code=$(echo "$response" | tail -n1)

if [ "$status_code" = "200" ]; then
  log_pass "Terminal page loads (HTTP 200)"
else
  log_fail "Terminal page returned HTTP $status_code"
fi

# Test 5: Check Python imports
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 5: Python Module Imports"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd /home/yasmine/Desktop/PLATFORM-SDN-FINAL/ONOS-CISCO/ONOS-IDS-platform/netguard-backend

if python3 -c "from app.routers import cisco_terminal; print('✓ cisco_terminal imported')" 2>/dev/null; then
  log_pass "cisco_terminal module imports correctly"
else
  log_fail "cisco_terminal module import failed"
fi

if python3 -c "from app.routers import cisco; print('✓ cisco imported')" 2>/dev/null; then
  log_pass "cisco module imports correctly"
else
  log_fail "cisco module import failed"
fi

# Test 6: Check Cisco device connectivity (if ONOS is running)
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 6: Cisco Device & ONOS Status"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check ONOS
if curl -s -u onos:rocks http://host.docker.internal:8181/onos/v1/applications/org.onos.csrmanager > /dev/null 2>&1; then
  log_pass "ONOS CsrManager app is reachable"
else
  log_info "ONOS not accessible (may be expected if not running on host.docker.internal)"
fi

# Test 7: Check Docker containers
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 7: Docker Containers"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd /home/yasmine/Desktop/PLATFORM-SDN-FINAL/ONOS-CISCO/ONOS-IDS-platform/netguard-backend

if docker compose ps | grep -q "netguard_api.*Up"; then
  log_pass "Backend container (netguard_api) is running"
else
  log_fail "Backend container not running"
fi

if docker compose ps | grep -q "netguard_db.*Up"; then
  log_pass "Database container (netguard_db) is running"
else
  log_fail "Database container not running"
fi

# Test 8: Check sidebar navigation
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 8: Sidebar Navigation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

SIDEBAR_FILE="/home/yasmine/Desktop/PLATFORM-SDN-FINAL/ONOS-CISCO/ONOS-IDS-platform/netguard-frontend/components/layout/app-sidebar.tsx"

if grep -q "Cisco Terminal" "$SIDEBAR_FILE"; then
  log_pass "Cisco Terminal link added to sidebar"
else
  log_fail "Cisco Terminal link not found in sidebar"
fi

if grep -q "dashboard/cisco/terminal" "$SIDEBAR_FILE"; then
  log_pass "Cisco Terminal route configured correctly"
else
  log_fail "Cisco Terminal route not found in sidebar"
fi

# Test 9: Check files exist
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 9: File Existence"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

FILES=(
  "/home/yasmine/Desktop/PLATFORM-SDN-FINAL/ONOS-CISCO/ONOS-IDS-platform/netguard-backend/app/routers/cisco_terminal.py"
  "/home/yasmine/Desktop/PLATFORM-SDN-FINAL/ONOS-CISCO/ONOS-IDS-platform/netguard-frontend/app/dashboard/cisco/terminal/page.tsx"
  "/home/yasmine/Desktop/PLATFORM-SDN-FINAL/ONOS-CISCO/ONOS-IDS-platform/netguard-frontend/app/api/cisco/terminal/route.ts"
)

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    log_pass "File exists: $(basename $file)"
  else
    log_fail "File missing: $file"
  fi
done

# Summary
echo ""
echo "============================================"
echo "📊 Test Summary"
echo "============================================"
echo -e "${GREEN}Passed: $PASS${NC}"
echo -e "${RED}Failed: $FAIL${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
  echo -e "${GREEN}✅ All tests passed!${NC}"
  exit 0
else
  echo -e "${RED}❌ Some tests failed${NC}"
  exit 1
fi
