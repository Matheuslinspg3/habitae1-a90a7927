# .env.example - Habitae
# Variáveis gerenciadas automaticamente pelo Lovable Cloud (NÃO editar manualmente)

VITE_SUPABASE_URL="https://<project-id>.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJ..."
VITE_SUPABASE_PROJECT_ID="<project-id>"

# --- Variáveis opcionais do frontend ---
# VITE_GOOGLE_MAPS_EMBED_KEY  → Chave Google Maps Embed (restringir por domínio no console GCP)
# VITE_RENEWAL_URL            → URL externa do fluxo de renovação de assinatura

# --- Secrets configurados no backend (Edge Functions) ---
# LOVABLE_API_KEY        → Auto-provisionado pelo Lovable Cloud
# CLOUDINARY_CLOUD_NAME  → Upload de imagens
# CLOUDINARY_API_KEY     → Upload de imagens
# CLOUDINARY_API_SECRET  → Upload de imagens
# R2_ACCESS_KEY_ID       → Storage fallback (Cloudflare R2)
# R2_SECRET_ACCESS_KEY   → Storage fallback
# R2_BUCKET_NAME         → Storage fallback
# R2_ENDPOINT            → Storage fallback
# R2_PUBLIC_URL          → Storage fallback

# --- Boas Práticas ---
# 1. NUNCA comitar .env com valores reais
# 2. Rotacionar chaves imediatamente em caso de exposição
# 3. Restringir chaves por domínio/referrer (Google Maps, etc.)
# 4. Separar segredos por ambiente (Test vs Prod)
# 5. Chaves VITE_* são expostas no bundle do frontend — usar apenas para chaves públicas
#
# --- Rotação e Restrição de Chaves ---
# VITE_GOOGLE_MAPS_EMBED_KEY:
#   • Console GCP → APIs & Services → Credentials
#   • Restrição de aplicação: HTTP referrers
#     - *.lovable.app/*
#     - *.habitae1.lovable.app/*
#     - seu-dominio-customizado.com/*
#   • Restrição de API: somente "Maps Embed API"
#   • Rotação: a cada 90 dias ou em caso de vazamento
#   • Monitorar uso em GCP → APIs & Services → Dashboard
#
# Chaves de backend (Edge Functions):
#   • CLOUDINARY_API_SECRET, R2_SECRET_ACCESS_KEY: rotacionar a cada 90 dias
#   • Atualizar via Lovable Cloud → Secrets após rotação
#   • Nunca expor em logs, respostas HTTP ou código frontend
