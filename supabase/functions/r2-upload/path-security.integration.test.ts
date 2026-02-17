import { describe, expect, it } from 'vitest';

import { buildObjectPrefix, sanitizePathSegments } from './path-security';

describe('sanitizePathSegments', () => {
  it('rejects dot-dot traversal segments', () => {
    expect(() => sanitizePathSegments('../../admin')).toThrow(/path traversal/i);
  });

  it('rejects encoded dot-dot traversal segments', () => {
    expect(() => sanitizePathSegments('%2e%2e/%2e%2e/secret')).toThrow(/path traversal/i);
  });

  it('rejects duplicated slashes', () => {
    expect(() => sanitizePathSegments('safe//nested')).toThrow(/barras duplicadas/i);
  });

  it('rejects invalid characters', () => {
    expect(() => sanitizePathSegments('safe/nested?bad')).toThrow(/não permitidos/i);
  });

  it('normalizes valid path segments', () => {
    expect(sanitizePathSegments('/media/property_images/')).toEqual(['media', 'property_images']);
  });
});

describe('buildObjectPrefix', () => {
  const claims = {
    organization_id: 'org_123',
  };

  it('always prefixes with authenticated organization context', () => {
    expect(buildObjectPrefix(claims, 'gallery/front')).toBe('properties/org_123/gallery/front');
  });

  it('ignores empty folder payload and keeps safe base prefix', () => {
    expect(buildObjectPrefix(claims, '')).toBe('properties/org_123');
  });

  it('rejects folder traversal payloads', () => {
    expect(() => buildObjectPrefix(claims, '../../private')).toThrow(/path traversal/i);
    expect(() => buildObjectPrefix(claims, '%2e%2e/%2e%2e/private')).toThrow(/path traversal/i);
  });

  it('rejects when organization id is missing from auth context', () => {
    expect(() => buildObjectPrefix({}, 'gallery')).toThrow(/organização não encontrada/i);
  });
});
