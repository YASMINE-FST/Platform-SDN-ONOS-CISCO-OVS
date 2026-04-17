#!/usr/bin/env bash

set -u

ONOS_HOST="${ONOS_HOST:-localhost}"
ONOS_PORT="${ONOS_PORT:-8181}"
ONOS_USER="${ONOS_USER:-onos}"
ONOS_PASS="${ONOS_PASS:-rocks}"
CSR_BASE_PATH="${CSR_BASE_PATH:-/csr/v1}"
CSR_DEVICE_ID="${CSR_DEVICE_ID:-}"

BASE_URL="http://${ONOS_HOST}:${ONOS_PORT}${CSR_BASE_PATH}"
AUTH="${ONOS_USER}:${ONOS_PASS}"

PASS_COUNT=0
FAIL_COUNT=0

run_check() {
  local name="$1"
  local path="$2"
  local url

  if [[ "${path}" == http://* || "${path}" == https://* ]]; then
    url="${path}"
  else
    url="${BASE_URL}${path}"
  fi

  if [[ -n "${CSR_DEVICE_ID}" ]]; then
    if [[ "${url}" == *\?* ]]; then
      url="${url}&device=${CSR_DEVICE_ID}"
    else
      url="${url}?device=${CSR_DEVICE_ID}"
    fi
  fi

  local http_code
  http_code="$(curl -sS -u "${AUTH}" -o /tmp/csrmanager_smoke_body.json -w "%{http_code}" "${url}")"
  if [[ "${http_code}" == "200" ]]; then
    PASS_COUNT=$((PASS_COUNT + 1))
    printf '[PASS] %-18s %s\n' "${name}" "${url}"
  else
    FAIL_COUNT=$((FAIL_COUNT + 1))
    printf '[FAIL] %-18s %s (HTTP %s)\n' "${name}" "${url}" "${http_code}"
    printf '       body: '
    tr '\n' ' ' < /tmp/csrmanager_smoke_body.json
    printf '\n'
  fi
}

printf 'CsrManager smoke test\n'
printf 'ONOS: %s:%s\n' "${ONOS_HOST}" "${ONOS_PORT}"
printf 'Base URL: %s\n' "${BASE_URL}"
if [[ -n "${CSR_DEVICE_ID}" ]]; then
  printf 'Device: %s\n' "${CSR_DEVICE_ID}"
fi
printf '\n'

run_check "app-status" "http://${ONOS_HOST}:${ONOS_PORT}/onos/v1/applications/org.onos.csrmanager"
run_check "devices" "/devices"
run_check "health" "/health"
run_check "cpu" "/cpu"
run_check "memory" "/memory"
run_check "version" "/version"
run_check "interfaces" "/interfaces"
run_check "interfaces-oper" "/interfaces/oper"
run_check "routes" "/routes"
run_check "arp" "/arp"
run_check "ospf" "/ospf"
run_check "bgp" "/bgp"
run_check "cdp" "/cdp"
run_check "ntp" "/ntp"
run_check "dhcp" "/dhcp"
run_check "processes" "/processes"
run_check "environment" "/environment"
run_check "logs" "/logs?limit=10"
run_check "cpu-history" "/cpu/history"

printf '\nSummary: %s passed, %s failed\n' "${PASS_COUNT}" "${FAIL_COUNT}"

if [[ "${FAIL_COUNT}" -gt 0 ]]; then
  exit 1
fi
