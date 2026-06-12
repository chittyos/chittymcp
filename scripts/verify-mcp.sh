#!/usr/bin/env bash
#
# verify-mcp.sh — produce the canonical MCP evidence required by MCP-SOP §6.
#
# Initializes a streamable-HTTP MCP session against a service endpoint, then
# lists tools / prompts / resources and reads each resource to prove it returns
# real data (not a mock). Emits a compact evidence block suitable for pasting
# into a PR body.
#
# Usage:
#   scripts/verify-mcp.sh <service>            # → https://<service>.chitty.cc/mcp
#   scripts/verify-mcp.sh <url>                # any full https://.../mcp endpoint
#   scripts/verify-mcp.sh <service> --origin   # → https://chittyagent-<service>.ccorp.workers.dev/mcp
#                                              #   (use when the canonical domain is CF-Access-gated)
#   MCP_BEARER=xxx scripts/verify-mcp.sh ...   # send Authorization: Bearer (aggregator path)
#   scripts/verify-mcp.sh <service> --read     # also resources/read every resource (proves live data)
#
# Exit codes: 0 = initialize + tools/list succeeded; 1 = usage; 2 = endpoint unreachable/unauthorized.
set -euo pipefail

ARG="${1:-}"
[ -z "$ARG" ] && { echo "usage: $0 <service|url> [--origin] [--read]"; exit 1; }
shift || true

ORIGIN=0; READ=0
for f in "$@"; do
  case "$f" in
    --origin) ORIGIN=1 ;;
    --read)   READ=1 ;;
    *) echo "unknown flag: $f"; exit 1 ;;
  esac
done

case "$ARG" in
  https://*) URL="$ARG" ;;
  *) if [ "$ORIGIN" = 1 ]; then URL="https://chittyagent-${ARG}.ccorp.workers.dev/mcp"; else URL="https://${ARG}.chitty.cc/mcp"; fi ;;
esac

AUTH=(); [ -n "${MCP_BEARER:-}" ] && AUTH=(-H "authorization: Bearer ${MCP_BEARER}")
ACCEPT="application/json, text/event-stream"
CT="content-type: application/json"

# Parse a JSON-RPC response body (plain JSON or SSE `data:` framed) and pull a
# named field out of result.<key>[]. Robust against prompt argument `name`s
# (which would pollute a naive grep) by reading only top-level list items.
#   field <body> <list> <item-field>   e.g. field "$P" prompts name
field() {
  MCP_BODY="$1" python3 - "$2" "$3" <<'PY'
import os, sys, json
listk, itemk = sys.argv[1], sys.argv[2]
raw = os.environ.get("MCP_BODY", "")
obj = None
for line in raw.splitlines():
    line = line[6:] if line.startswith("data: ") else line
    line = line.strip()
    if not line.startswith("{"): continue
    try: o = json.loads(line)
    except Exception: continue
    if isinstance(o, dict) and ("result" in o or "error" in o): obj = o
if obj is None: print("__none__"); sys.exit()
if "error" in obj: print("__error__:" + str(obj["error"].get("code")) + ":" + obj["error"].get("message","")); sys.exit()
items = (obj.get("result") or {}).get(listk) or []
print("\n".join(str(i.get(itemk,"")) for i in items))
PY
}

rpc() { # rpc <session-id-or-empty> <json-body>  → prints raw response body
  local sid="$1"; shift
  local hdr=(); [ -n "$sid" ] && hdr=(-H "mcp-session-id: $sid")
  curl -fsS --max-time 25 -X POST "$URL" -H "$CT" -H "accept: $ACCEPT" "${AUTH[@]}" "${hdr[@]}" -d "$1" 2>/dev/null
}
joined() { paste -sd, - | sed 's/,/, /g'; }  # newline list → "a, b, c"

echo "── MCP verification: $URL ──"

# 1. initialize (capture session id from response headers)
HDRS="$(curl -fsS --max-time 25 -D - -o /dev/null -X POST "$URL" -H "$CT" -H "accept: $ACCEPT" "${AUTH[@]}" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"verify-mcp","version":"1"}}}' 2>/dev/null)" || {
    echo "  initialize FAILED (unreachable / unauthorized). Try --origin if the canonical domain is Access-gated, or set MCP_BEARER for the aggregator path."; exit 2; }
SID="$(printf '%s' "$HDRS" | grep -ai '^mcp-session-id:' | tr -d '\r' | awk '{print $2}')"
echo "  session: ${SID:-<none>}"

names() { local out; out="$(field "$1" "$2" "$3")"; [ "$out" = "__none__" ] && return 2
  case "$out" in __error__:*) return 3;; esac
  printf '%s' "$out"; }
# Describe why a list call returned nothing, from the raw body.
why() { if printf '%s' "$1" | grep -q '\-32601'; then echo "unsupported (-32601)"; else echo "error/empty"; fi; }

TOOLS="$(rpc "$SID" '{"jsonrpc":"2.0","id":2,"method":"tools/list"}')"
T="$(names "$TOOLS" tools name)"; n=$(printf '%s' "$T" | grep -c . || true)
echo "  tools/list:     ${n} — $(printf '%s' "$T" | head -8 | joined)"

PROMPTS="$(rpc "$SID" '{"jsonrpc":"2.0","id":3,"method":"prompts/list"}')"
if P="$(names "$PROMPTS" prompts name)"; then n=$(printf '%s' "$P" | grep -c . || true)
  echo "  prompts/list:   ${n} — $(printf '%s' "$P" | joined)"
else echo "  prompts/list:   $(why "$PROMPTS")"; fi

RES="$(rpc "$SID" '{"jsonrpc":"2.0","id":4,"method":"resources/list"}')"
if URIS="$(names "$RES" resources uri)"; then n=$(printf '%s' "$URIS" | grep -c . || true)
  echo "  resources/list: ${n} — $(printf '%s' "$URIS" | joined)"
  if [ "$READ" = 1 ] && [ -n "$URIS" ]; then
    echo "  resources/read:"
    while IFS= read -r u; do [ -z "$u" ] && continue
      body="$(rpc "$SID" "{\"jsonrpc\":\"2.0\",\"id\":5,\"method\":\"resources/read\",\"params\":{\"uri\":\"$u\"}}")"
      txt="$(field "$body" contents text | head -1)"
      if printf '%s' "$body" | grep -q '"error"'; then echo "    $u → ERROR"
      elif [ -n "$txt" ] && [ "$txt" != "__none__" ]; then echo "    $u → live: $(printf '%s' "$txt" | tr -d '\n' | cut -c1-70)…"
      else echo "    $u → (read returned no text)"; fi
    done <<< "$URIS"
  fi
else echo "  resources/list: $(why "$RES")"; fi
echo "── ok ──"
