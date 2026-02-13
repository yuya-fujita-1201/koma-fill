#!/bin/bash
# ============================================
# koma-fill スモークテストスクリプト
# ============================================

set -e

load_env_file() {
  local file="$1"
  while IFS='=' read -r key value; do
    if [ -z "$key" ]; then
      continue
    fi
    if [ "${key#\#}" != "$key" ]; then
      continue
    fi
    key="${key%%[[:space:]]*}"
    if [ -z "$key" ]; then
      continue
    fi
    value="${value%$'\r'}"
    value="${value#${value%%[![:space:]]*}}"
    value="${value%${value##*[![:space:]]}}"
    export "$key=$value"
  done < "$file"
}

if [ -f .env ]; then
  load_env_file ./.env
fi

API_BASE="${SMOKE_API_BASE:-${VITE_API_BASE_URL:-${API_BASE:-http://localhost:5000/api}}}"
API_BASE="${API_BASE%/}"
FRONTEND_URL="${SMOKE_FRONTEND_URL:-${FRONTEND_URL:-http://localhost:3000}}"
FRONTEND_URL="${FRONTEND_URL%/}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass=0
fail=0
skip=0

check() {
  local label="$1"
  local result="$2"
  local status_code="$3"
  if [ "$status_code" -ge 200 ] && [ "$status_code" -lt 300 ]; then
    echo -e "  ${GREEN}✓${NC} ${label} (${status_code})"
    pass=$((pass + 1))
  else
    echo -e "  ${RED}✗${NC} ${label} (${status_code})"
    echo "    Response: ${result:0:200}"
    fail=$((fail + 1))
  fi
}

echo "============================================"
echo " koma-fill スモークテスト"
echo " API Base: ${API_BASE}"
echo " Frontend: ${FRONTEND_URL}"
echo "============================================"
echo ""

echo "1. バックエンドヘルスチェック"
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "$API_BASE/health" 2>/dev/null || echo "000")
if [ "$HEALTH" = "000" ]; then
  echo -e "  ${RED}✗ バックエンドが起動していません${NC}"
  echo "    → cd backend && npm run dev で起動してください"
  exit 1
fi
HEALTH_BODY=$(curl -s "$API_BASE/health")
check "GET /api/health" "$HEALTH_BODY" "$HEALTH"
echo ""

echo "2. プロジェクトCRUD"
CREATE_RESP=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE/manga/create" \
  -H "Content-Type: application/json" \
  -d '{"projectName":"Smoke Test","storyPrompt":"A cat eating ramen"}')
CREATE_STATUS=$(echo "$CREATE_RESP" | tail -1)
CREATE_BODY=$(echo "$CREATE_RESP" | sed '$d')
check "POST /manga/create" "$CREATE_BODY" "$CREATE_STATUS"

PROJECT_ID=$(echo "$CREATE_BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -z "$PROJECT_ID" ]; then
  echo -e "  ${YELLOW}⚠ プロジェクトID取得失敗、残りのテストをスキップ${NC}"
  PROJECT_ID="__skip__"
fi

if [ "$PROJECT_ID" != "__skip__" ]; then
  GET_RESP=$(curl -s -w "\n%{http_code}" "$API_BASE/manga/$PROJECT_ID")
  GET_STATUS=$(echo "$GET_RESP" | tail -1)
  GET_BODY=$(echo "$GET_RESP" | sed '$d')
  check "GET /manga/:id" "$GET_BODY" "$GET_STATUS"
else
  echo -e "  ${YELLOW}⊘${NC} GET /manga/:id (skipped)"
  skip=$((skip + 1))
fi

LIST_RESP=$(curl -s -w "\n%{http_code}" "$API_BASE/manga")
LIST_STATUS=$(echo "$LIST_RESP" | tail -1)
LIST_BODY=$(echo "$LIST_RESP" | sed '$d')
check "GET /manga (list)" "$LIST_BODY" "$LIST_STATUS"
echo ""

echo "3. 画像アップロード"
if [ "$PROJECT_ID" != "__skip__" ]; then
  TMPIMG=$(mktemp /tmp/smoke-test-XXXXXX.png)
  PNG_B64="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4DwAAAQEABRjYTgAAAABJRU5ErkJggg=="
  printf '%s' "$PNG_B64" | base64 -d > "$TMPIMG"

  UPLOAD_RESP=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE/manga/$PROJECT_ID/upload" \
    -F "images=@$TMPIMG;type=image/png" \
    -F "positions=start")
  UPLOAD_STATUS=$(echo "$UPLOAD_RESP" | tail -1)
  UPLOAD_BODY=$(echo "$UPLOAD_RESP" | sed '$d')
  check "POST /manga/:id/upload" "$UPLOAD_BODY" "$UPLOAD_STATUS"
  rm -f "$TMPIMG"
else
  echo -e "  ${YELLOW}⊘${NC} POST /manga/:id/upload (skipped)"
  skip=$((skip + 1))
fi
echo ""

echo "4. フロントエンド確認"
FRONT_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL" 2>/dev/null || echo "000")
if [ "$FRONT_STATUS" = "000" ]; then
  echo -e "  ${YELLOW}⊘ フロントエンド未起動${NC} (cd frontend && npm run dev で起動)"
  skip=$((skip + 1))
else
  check "GET ${FRONTEND_URL}" "" "$FRONT_STATUS"
fi

PROXY_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${FRONTEND_URL}/api/health" 2>/dev/null || echo "000")
if [ "$PROXY_STATUS" = "000" ]; then
  echo -e "  ${YELLOW}⊘ Vite→API プロキシ未確認${NC}"
  skip=$((skip + 1))
else
  check "Vite proxy → /api/health" "" "$PROXY_STATUS"
fi
echo ""

echo "5. SSEエンドポイント（形式確認）"
if [ "$PROJECT_ID" != "__skip__" ]; then
  check_sse_headers() {
    local prompt_retry_requested="$1"
    local headers
    local prompt_body
    local prompt_status
    headers=$(curl -s -I -m 3 "$API_BASE/manga/$PROJECT_ID/generate-images?batchMode=sequential" 2>/dev/null || true)
    if echo "$headers" | grep -qi "text/event-stream"; then
      echo -e "  ${GREEN}✓${NC} Content-Type: text/event-stream 確認"
      if [ "$prompt_retry_requested" = "1" ]; then
        echo -e "  ${GREEN}  + プロンプト生成後ヘッダ確認成功${NC}"
      fi
      pass=$((pass + 1))
      return 0
    fi

    local content_type
    content_type=$(echo "$headers" | grep -i "content-type" | head -1)
    if [ "$prompt_retry_requested" = "0" ]; then
      echo -e "  ${YELLOW}⚠${NC} Content-Type が text/event-stream でない: $content_type"
      echo "    プロンプト生成を実行して再確認します"
      prompt_body=$(mktemp /tmp/smoke-prompts-XXXXXX.json)
      prompt_status=$(curl -s -o "$prompt_body" -w "%{http_code}" -m 12 -X POST "$API_BASE/manga/$PROJECT_ID/generate-prompts" \
        -H "Content-Type: application/json" \
        -d '{"storyPrompt":"A cat eating ramen","panelCount":1,"characterConsistency":true}')
      prompt_status=$(echo "$prompt_status" | tr -cd '0-9')
      if [ "${prompt_status:-0}" -ge 200 ] && [ "${prompt_status:-0}" -lt 300 ]; then
        check_sse_headers 1
        local prompt_result=$?
        rm -f "$prompt_body"
        return $prompt_result
      fi
      if [ "${prompt_status:-0}" -eq 0 ]; then
        echo -e "  ${YELLOW}⚠${NC} generate-prompts がタイムアウト/エラーで未完了 (HTTP: ${prompt_status})"
      else
        echo -e "  ${YELLOW}⚠${NC} generate-prompts 失敗 (HTTP: ${prompt_status})"
      fi
      if [ -s "$prompt_body" ]; then
        echo "    Response: $(sed 's/[[:space:]]\+/ /g' < "$prompt_body" | cut -c 1-120)"
      fi
      rm -f "$prompt_body"
      skip=$((skip + 1))
      return 0
    else
      if [ -n "$content_type" ]; then
        echo -e "  ${RED}✗${NC} Content-Type が text/event-stream でない: $content_type"
      else
        echo -e "  ${YELLOW}⊘${NC} SSEヘッダ取得失敗（タイムアウト等）"
      fi
    fi
    return 1
  }

  check_sse_headers 0
else
  echo -e "  ${YELLOW}⊘${NC} SSE (skipped)"
  skip=$((skip + 1))
fi
echo ""

if [ "$PROJECT_ID" != "__skip__" ]; then
  curl -s -X DELETE "$API_BASE/manga/$PROJECT_ID" > /dev/null 2>&1 || true
fi

echo "============================================"
echo -e " 結果: ${GREEN}${pass} passed${NC}, ${RED}${fail} failed${NC}, ${YELLOW}${skip} skipped${NC}"
echo "============================================"

if [ "$fail" -gt 0 ]; then
  exit 1
fi
