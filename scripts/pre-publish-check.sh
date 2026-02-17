#!/bin/bash
# =============================================================
# Habitae — Pre-Publish Quality Gates
# Execute antes de cada Publish para Produção.
# Uso: bash scripts/pre-publish-check.sh
# =============================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
FAIL=0
WARN=0

gate_pass() { echo -e "${GREEN}✅ PASS${NC} — $1"; ((PASS++)); }
gate_fail() { echo -e "${RED}❌ FAIL${NC} — $1"; ((FAIL++)); }
gate_warn() { echo -e "${YELLOW}⚠️  WARN${NC} — $1"; ((WARN++)); }

echo ""
echo "========================================="
echo "  Habitae — Pre-Publish Quality Gates"
echo "========================================="
echo ""

# Gate 1: Lint
echo "🔍 Gate 1/6: Lint..."
if npx eslint src/ --quiet 2>/dev/null; then
  gate_pass "Lint"
else
  gate_fail "Lint — corrigir erros antes de publicar"
fi

# Gate 2: Testes
echo "🧪 Gate 2/6: Testes..."
if npx vitest run --reporter=verbose 2>/dev/null; then
  gate_pass "Testes"
else
  gate_fail "Testes — todos devem passar antes de publicar"
fi

# Gate 3: Build
echo "🏗️  Gate 3/6: Build..."
if npx vite build 2>/dev/null; then
  gate_pass "Build"
else
  gate_fail "Build — build deve completar sem erros"
fi

# Gate 4: Scan de segredos
echo "🔐 Gate 4/6: Scan de segredos hardcoded..."
SECRETS_FOUND=$(grep -rn --include="*.ts" --include="*.tsx" --include="*.js" \
  -E "(sk_live|sk_test|secret_key|password=|apiKey\s*[:=]\s*['\"][a-zA-Z0-9]{20,})" \
  src/ 2>/dev/null | grep -v "node_modules" | grep -v ".test." | grep -v "// " || true)

if [ -z "$SECRETS_FOUND" ]; then
  gate_pass "Scan de segredos"
else
  gate_fail "Segredos hardcoded encontrados:"
  echo "$SECRETS_FOUND"
fi

# Gate 5: Dependências com vulnerabilidades
echo "📦 Gate 5/6: Auditoria de dependências..."
AUDIT_OUTPUT=$(npm audit --production 2>/dev/null || true)
if echo "$AUDIT_OUTPUT" | grep -q "found 0 vulnerabilities"; then
  gate_pass "Auditoria de dependências"
elif echo "$AUDIT_OUTPUT" | grep -qi "critical\|high"; then
  gate_warn "Vulnerabilidades encontradas — avaliar antes de publicar"
else
  gate_pass "Auditoria de dependências (sem críticas/altas)"
fi

# Gate 6: Verificar env vars obrigatórias
echo "🔧 Gate 6/6: Variáveis de ambiente..."
ENV_OK=true
for VAR in VITE_SUPABASE_URL VITE_SUPABASE_PUBLISHABLE_KEY; do
  if ! grep -q "$VAR" .env 2>/dev/null; then
    echo "  ⚠️  $VAR não encontrada em .env"
    ENV_OK=false
  fi
done
if $ENV_OK; then
  gate_pass "Variáveis de ambiente"
else
  gate_warn "Variáveis de ambiente — verificar .env"
fi

# Resultado
echo ""
echo "========================================="
echo "  RESULTADO"
echo "========================================="
echo -e "  ${GREEN}Passou: $PASS${NC}"
echo -e "  ${RED}Falhou: $FAIL${NC}"
echo -e "  ${YELLOW}Avisos: $WARN${NC}"
echo ""

if [ $FAIL -gt 0 ]; then
  echo -e "${RED}❌ NO-GO — Corrigir falhas antes de publicar.${NC}"
  exit 1
elif [ $WARN -gt 0 ]; then
  echo -e "${YELLOW}⚠️  GO COM RESTRIÇÕES — Avaliar avisos.${NC}"
  exit 0
else
  echo -e "${GREEN}✅ GO — Todos os gates passaram.${NC}"
  exit 0
fi
