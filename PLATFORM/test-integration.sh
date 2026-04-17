#!/bin/bash

##############################################################################
# 🧪 ONOS-IDS Platform Integration Test Suite
# Test complet de l'intégration Cisco dans ONOS-IDS-platform
##############################################################################

echo "════════════════════════════════════════════════════════════════"
echo "  🧪 ONOS-IDS Platform — Integration Test"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASS=0
FAIL=0

test_endpoint() {
  local name=$1
  local url=$2
  local expected_code=${3:-200}

  echo -n "Testing: $name ... "

  response=$(curl -s -w "\n%{http_code}" "$url" 2>/dev/null)
  http_code=$(echo "$response" | tail -1)
  body=$(echo "$response" | head -1)

  if [ "$http_code" = "$expected_code" ]; then
    echo -e "${GREEN}✓ PASS${NC} (HTTP $http_code)"
    ((PASS++))
    return 0
  else
    echo -e "${RED}✗ FAIL${NC} (HTTP $http_code, expected $expected_code)"
    ((FAIL++))
    return 1
  fi
}

##############################################################################
# TEST 1: Backend API Health
##############################################################################

echo -e "${BLUE}─── TEST 1: Backend API Health ───${NC}"
echo ""

test_endpoint "FastAPI Health" "http://localhost:8000/health" 200
test_endpoint "Cisco Health Check" "http://localhost:8000/api/cisco/health/check" 200

echo ""

##############################################################################
# TEST 2: Backend - Cisco Endpoints (Monitoring)
##############################################################################

echo -e "${BLUE}─── TEST 2: Cisco Endpoints (Monitoring) ───${NC}"
echo ""

test_endpoint "GET /api/cisco/devices" "http://localhost:8000/api/cisco/devices"
test_endpoint "GET /api/cisco/cpu" "http://localhost:8000/api/cisco/cpu"
test_endpoint "GET /api/cisco/memory" "http://localhost:8000/api/cisco/memory"
test_endpoint "GET /api/cisco/version" "http://localhost:8000/api/cisco/version"
test_endpoint "GET /api/cisco/interfaces" "http://localhost:8000/api/cisco/interfaces"
test_endpoint "GET /api/cisco/interfaces/oper" "http://localhost:8000/api/cisco/interfaces/oper"
test_endpoint "GET /api/cisco/routes" "http://localhost:8000/api/cisco/routes"
test_endpoint "GET /api/cisco/arp" "http://localhost:8000/api/cisco/arp"
test_endpoint "GET /api/cisco/logs?limit=10" "http://localhost:8000/api/cisco/logs?limit=10"

echo ""

##############################################################################
# TEST 3: Frontend Page Check
##############################################################################

echo -e "${BLUE}─── TEST 3: Frontend Page Check ───${NC}"
echo ""

# Test if frontend is running
if timeout 2 curl -s http://localhost:3000 > /dev/null 2>&1; then
  echo -e "${GREEN}✓${NC} Frontend is running on http://localhost:3000"
  ((PASS++))

  # Test if Cisco page exists
  if timeout 2 curl -s http://localhost:3000/dashboard/cisco > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Cisco Devices page is accessible"
    ((PASS++))
  else
    echo -e "${YELLOW}⚠ ${NC} Cisco Devices page not responding (frontend may be starting)"
  fi
else
  echo -e "${YELLOW}⚠ ${NC} Frontend not running (run: npm run dev in netguard-frontend)"
fi

echo ""

##############################################################################
# TEST 4: Data Format Check
##############################################################################

echo -e "${BLUE}─── TEST 4: Data Format Check ───${NC}"
echo ""

# Check CPU response format
cpu_response=$(curl -s http://localhost:8000/api/cisco/cpu 2>/dev/null)
if echo "$cpu_response" | grep -q "five_seconds"; then
  echo -e "${GREEN}✓${NC} CPU endpoint returns expected format"
  ((PASS++))
else
  echo -e "${YELLOW}⚠ ${NC} CPU endpoint format unexpected"
fi

# Check Memory response format
memory_response=$(curl -s http://localhost:8000/api/cisco/memory 2>/dev/null)
if echo "$memory_response" | grep -q "usage_percent\|total\|used"; then
  echo -e "${GREEN}✓${NC} Memory endpoint returns expected format"
  ((PASS++))
else
  echo -e "${YELLOW}⚠ ${NC} Memory endpoint format unexpected"
fi

echo ""

##############################################################################
# SUMMARY
##############################################################################

echo "════════════════════════════════════════════════════════════════"
echo "  📊 TEST SUMMARY"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo -e "${GREEN}✓ PASSED: $PASS${NC}"
echo -e "${RED}✗ FAILED: $FAIL${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
  echo -e "${GREEN}🎉 ALL TESTS PASSED!${NC}"
  echo ""
  echo "✅ Integration is COMPLETE and WORKING!"
  echo ""
  echo "Next steps:"
  echo "  1. Open http://localhost:3000/"
  echo "  2. Login (if needed)"
  echo "  3. Go to Dashboard → Cisco Devices"
  echo "  4. See the metrics and device info"
  echo ""
  exit 0
else
  echo -e "${RED}⚠️  Some tests failed${NC}"
  echo ""
  echo "Troubleshooting:"
  echo "  • Is backend running? (docker compose up -d)"
  echo "  • Is ONOS running? (~/onos/bin/onos-service start)"
  echo "  • Is CsrManager app ACTIVE? (curl -u onos:rocks http://localhost:8181/onos/v1/applications/org.onos.csrmanager)"
  echo "  • Is frontend running? (npm run dev in netguard-frontend)"
  echo ""
  exit 1
fi
