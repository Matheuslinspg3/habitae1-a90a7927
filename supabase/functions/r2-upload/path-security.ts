const SEGMENT_WHITELIST = /^[A-Za-z0-9_-]+$/;

function decodePathInput(rawPath: string): string {
  try {
    return decodeURIComponent(rawPath);
  } catch {
    return rawPath;
  }
}

export function sanitizePathSegments(rawPath: string): string[] {
  const decoded = decodePathInput(rawPath).replace(/\\/g, '/').trim();
  if (!decoded) return [];

  if (decoded.includes('//')) {
    throw new Error('Caminho inválido: barras duplicadas não são permitidas');
  }

  const segments = decoded.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
  for (const segment of segments) {
    if (segment === '.' || segment === '..') {
      throw new Error('Caminho inválido: path traversal detectado');
    }

    if (!SEGMENT_WHITELIST.test(segment)) {
      throw new Error('Caminho inválido: segmento contém caracteres não permitidos');
    }
  }

  return segments;
}

type Claims = Record<string, unknown>;

export function extractOrganizationIdFromClaims(claims: Claims): string | null {
  const appMetadata = claims.app_metadata as Claims | undefined;
  const userMetadata = claims.user_metadata as Claims | undefined;

  const candidates = [
    claims.organization_id,
    claims.org_id,
    appMetadata?.organization_id,
    appMetadata?.org_id,
    userMetadata?.organization_id,
    userMetadata?.org_id,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
}

export function buildObjectPrefix(claims: Claims, folderInput: string | null): string {
  const organizationId = extractOrganizationIdFromClaims(claims);
  if (!organizationId) {
    throw new Error('Organização não encontrada no contexto autenticado');
  }

  const [sanitizedOrganizationId] = sanitizePathSegments(organizationId);
  if (!sanitizedOrganizationId) {
    throw new Error('ID da organização inválido no contexto autenticado');
  }

  const baseSegments = ['properties', sanitizedOrganizationId];
  const userFolderSegments = sanitizePathSegments(folderInput ?? '');

  return [...baseSegments, ...userFolderSegments].join('/');
}

