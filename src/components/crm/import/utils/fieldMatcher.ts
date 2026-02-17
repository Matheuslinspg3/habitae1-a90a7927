export interface FieldMapping {
  csvField: string;
  habitaeField: string | null;
}

export const HABITAE_FIELDS = [
  { id: 'name', label: 'Nome do Lead', required: true },
  { id: 'phone', label: 'Telefone / WhatsApp' },
  { id: 'email', label: 'Email' },
  { id: 'source', label: 'Origem' },
  { id: 'estimated_value', label: 'Valor de Interesse' },
  { id: 'notes', label: 'Observações' },
  { id: 'broker_name', label: 'Corretor Responsável' },
  { id: 'stage', label: 'Status / Etapa' },
  { id: 'property_type', label: 'Tipo de Imóvel' },
  { id: 'neighborhood', label: 'Bairro' },
  { id: 'city', label: 'Cidade' },
  { id: 'created_at', label: 'Data de Cadastro' },
] as const;

const SYNONYMS: Record<string, string[]> = {
  name: ['nome', 'name', 'nome_completo', 'full_name', 'lead', 'cliente', 'client', 'contato', 'contact'],
  phone: ['telefone', 'phone', 'tel', 'celular', 'mobile', 'whatsapp', 'fone', 'cellphone'],
  email: ['email', 'e-mail', 'mail', 'e_mail', 'correio'],
  source: ['origem', 'source', 'fonte', 'canal', 'origin', 'channel', 'midia'],
  estimated_value: ['valor', 'value', 'estimated_value', 'valor_estimado', 'budget', 'orcamento', 'preco', 'price'],
  notes: ['notas', 'notes', 'observacao', 'observacoes', 'obs', 'comentario', 'description', 'descricao'],
  broker_name: ['corretor', 'broker', 'responsavel', 'agente', 'agent', 'vendedor', 'seller'],
  stage: ['status', 'stage', 'etapa', 'fase', 'funil', 'pipeline'],
  property_type: ['tipo_imovel', 'property_type', 'tipo', 'type', 'categoria'],
  neighborhood: ['bairro', 'neighborhood', 'regiao', 'setor'],
  city: ['cidade', 'city', 'municipio'],
  created_at: ['data', 'date', 'data_cadastro', 'created_at', 'criado_em', 'data_criacao'],
};

function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

export function autoMapFields(csvHeaders: string[]): FieldMapping[] {
  return csvHeaders.map(header => {
    const normalized = normalize(header);
    let bestMatch: string | null = null;

    for (const [fieldId, synonyms] of Object.entries(SYNONYMS)) {
      if (synonyms.some(s => normalized === s || normalized.includes(s) || s.includes(normalized))) {
        bestMatch = fieldId;
        break;
      }
    }

    return { csvField: header, habitaeField: bestMatch };
  });
}

export function validateMapping(mappings: FieldMapping[]): { valid: boolean; error?: string } {
  const mapped = mappings.filter(m => m.habitaeField);
  const hasName = mapped.some(m => m.habitaeField === 'name');
  const hasPhone = mapped.some(m => m.habitaeField === 'phone');
  const hasEmail = mapped.some(m => m.habitaeField === 'email');

  if (!hasName && !hasPhone && !hasEmail) {
    return { valid: false, error: 'Mapeie pelo menos Nome, Telefone ou Email' };
  }
  return { valid: true };
}
