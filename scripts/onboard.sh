#!/bin/bash
set -euo pipefail
echo "=== chittymcp Onboarding ==="
curl -s -X POST "${GETCHITTY_ENDPOINT:-https://get.chitty.cc/api/onboard}" \
  -H "Content-Type: application/json" \
  -d '{"service_name":"chittymcp","organization":"CHITTYOS","type":"platform","tier":2,"domains":["mcp.chitty.cc"]}' | jq .
