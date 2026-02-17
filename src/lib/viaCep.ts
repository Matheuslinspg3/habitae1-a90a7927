export interface ViaCepResponse {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

export async function fetchAddressByCep(cep: string): Promise<ViaCepResponse | null> {
  const cleanCep = cep.replace(/\D/g, '');
  
  if (cleanCep.length !== 8) {
    return null;
  }

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
    const data: ViaCepResponse = await response.json();
    
    if (data.erro) {
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Erro ao buscar CEP:', error);
    return null;
  }
}

/**
 * Search addresses by street name using ViaCEP.
 * Requires UF (state) and city to be provided.
 * Street name must be at least 3 characters.
 */
export async function searchAddressByStreet(
  uf: string,
  city: string,
  street: string
): Promise<ViaCepResponse[]> {
  const trimmedStreet = street.trim();
  if (!uf || !city || trimmedStreet.length < 3) return [];

  try {
    const response = await fetch(
      `https://viacep.com.br/ws/${encodeURIComponent(uf)}/${encodeURIComponent(city)}/${encodeURIComponent(trimmedStreet)}/json/`
    );
    if (!response.ok) return [];
    const data = await response.json();
    if (Array.isArray(data)) return data;
    return [];
  } catch {
    return [];
  }
}

export function formatCep(value: string): string {
  const numbers = value.replace(/\D/g, '');
  if (numbers.length <= 5) {
    return numbers;
  }
  return `${numbers.slice(0, 5)}-${numbers.slice(5, 8)}`;
}
