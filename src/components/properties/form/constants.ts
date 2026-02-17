// Expanded amenities list
export const AMENITIES_OPTIONS = [
  // Lazer
  "Piscina", "Churrasqueira", "Sacada com Churrasqueira", "Academia",
  "Salão de Festas", "Salão de Jogos", "Playground", "Quadra Esportiva",
  "Cinema", "Sauna",
  // Vista e Localização
  "Vista Mar", "Frente Mar", "Varanda", "Jardim",
  // Infraestrutura
  "Segurança 24h", "Portaria", "Elevador", "Ar Condicionado",
  "Garagem", "Entrada Independente",
  // Mobília
  "Mobiliado", "Semi Mobiliado", "Sala de TV", "Sala de Jantar",
  // Conveniência
  "Mini Mercado",
  // Tipo de Construção
  "Sobreposta Alta", "Térreo",
  // Zona Fiscal
  "Zona 1", "Zona 2", "Zona 3",
  // Banheiros
  "Lavabo",
];

// Formas de Pagamento
export const PAYMENT_OPTIONS = [
  "Aceita Financiamento Bancário",
  "Aceita Financiamento Direto",
  "Somente à Vista",
  "Aceita Permuta",
  "Aceita Veículo",
];

// Campos por aba para validação de erros
export const TAB_FIELDS: Record<string, string[]> = {
  basic: ["property_type_id", "transaction_type", "status"],
  values: ["sale_price", "sale_price_financed", "rent_price", "condominium_fee", "iptu_monthly", "inspection_fee", "commission_type", "commission_value"],
  features: ["bedrooms", "suites", "bathrooms", "parking_spots", "area_useful", "area_total", "area_built", "floor", "beach_distance_meters"],
  location: ["address_zipcode", "address_street", "address_number", "address_complement", "address_neighborhood", "address_city", "address_state"],
  owner: ["owner_name", "owner_phone", "owner_email", "owner_document", "owner_notes"],
  photos: [],
  description: ["description"],
};
