// Demo data for Habitae demonstration mode
// This file contains all mock data for the demo experience

// Lead stages are now dynamic (database-driven), so we use plain strings for demo data

// ============= TYPES =============

export interface DemoProperty {
  id: string;
  title: string;
  description: string;
  transaction_type: 'venda' | 'aluguel' | 'ambos';
  status: 'disponivel' | 'reservado' | 'vendido' | 'alugado' | 'inativo' | 'com_proposta' | 'suspenso';
  sale_price: number | null;
  rent_price: number | null;
  address_street: string;
  address_number: string;
  address_neighborhood: string;
  address_city: string;
  address_state: string;
  address_zipcode: string;
  bedrooms: number | null;
  bathrooms: number | null;
  parking_spots: number | null;
  area_total: number | null;
  area_built: number | null;
  property_type: { id: string; name: string } | null;
  images: { id: string; url: string; is_cover: boolean }[];
  created_at: string;
  updated_at: string;
  // Novos campos
  launch_stage?: 'nenhum' | 'em_construcao' | 'pronto';
  development_name?: string | null;
  property_condition?: 'novo' | 'usado' | null;
  iptu_monthly?: number | null;
  commission_type?: 'valor' | 'percentual';
  commission_value?: number | null;
  inspection_fee?: number | null;
  beach_distance_meters?: number | null;
  captador_id?: string | null;
}

export interface DemoLead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  stage: string;
  source: string | null;
  estimated_value: number | null;
  notes: string | null;
  lead_type: { id: string; name: string; color: string } | null;
  lead_type_id?: string | null;
  property: { id: string; title: string } | null;
  property_id?: string | null;
  broker: { id: string; full_name: string } | null;
  broker_id?: string | null;
  interested_property_type?: { id: string; name: string } | null;
  interested_property_type_id?: string | null;
  is_active?: boolean;
  created_at: string;
  updated_at: string;
}

export interface DemoContract {
  id: string;
  code: string;
  type: 'venda' | 'locacao';
  status: 'rascunho' | 'ativo' | 'encerrado' | 'cancelado';
  value: number;
  commission_percentage: number | null;
  start_date: string | null;
  end_date: string | null;
  property: { id: string; title: string } | null;
  lead: { id: string; name: string } | null;
  broker: { id: string; full_name: string } | null;
  created_at: string;
}

export interface DemoTransaction {
  id: string;
  type: 'receita' | 'despesa';
  description: string;
  amount: number;
  date: string;
  paid: boolean;
  paid_at: string | null;
  category: { id: string; name: string } | null;
  contract: { id: string; code: string } | null;
  created_at: string;
}

export interface DemoTask {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: 'baixa' | 'media' | 'alta';
  completed: boolean;
  completed_at: string | null;
  lead: { id: string; name: string } | null;
  created_at: string;
}

export interface DemoAppointment {
  id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  location: string | null;
  completed: boolean;
  lead: { id: string; name: string } | null;
  property: { id: string; title: string } | null;
  created_at: string;
}

export interface DemoActivity {
  id: string;
  type: 'lead_created' | 'contract_signed' | 'appointment_scheduled' | 'commission_received' | 'property_created' | 'task_completed';
  title: string;
  description: string;
  timestamp: string;
  icon: 'user' | 'file' | 'calendar' | 'dollar' | 'home' | 'check';
}

// ============= HELPER FUNCTIONS =============

function getDateOffset(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function getTodayAt(hours: number, minutes: number = 0): string {
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
}

// ============= DEMO PROPERTIES (12) =============

export const demoProperties: DemoProperty[] = [
  // Apartamentos (5)
  {
    id: 'demo-prop-1',
    title: 'Apartamento 3 Quartos - Vista Mar',
    description: 'Lindo apartamento com 3 quartos, sendo 1 suíte, vista panorâmica para o mar. Condomínio com piscina e academia.',
    transaction_type: 'venda',
    status: 'disponivel',
    sale_price: 850000,
    rent_price: null,
    address_street: 'Av. Atlântica',
    address_number: '1500',
    address_neighborhood: 'Copacabana',
    address_city: 'Rio de Janeiro',
    address_state: 'RJ',
    address_zipcode: '22021-000',
    bedrooms: 3,
    bathrooms: 2,
    parking_spots: 1,
    area_total: 120,
    area_built: 95,
    property_type: { id: 'type-1', name: 'Apartamento' },
    images: [{ id: 'img-1', url: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800', is_cover: true }],
    created_at: getDateOffset(-30),
    updated_at: getDateOffset(-5),
    launch_stage: 'pronto',
    property_condition: 'novo',
    beach_distance_meters: 50,
    commission_type: 'percentual',
    commission_value: 6,
  },
  {
    id: 'demo-prop-2',
    title: 'Apartamento 2 Quartos - Alto Padrão',
    description: 'Apartamento reformado em prédio de alto padrão. Área de lazer completa, portaria 24h.',
    transaction_type: 'venda',
    status: 'reservado',
    sale_price: 1200000,
    rent_price: null,
    address_street: 'Rua Visconde de Pirajá',
    address_number: '800',
    address_neighborhood: 'Ipanema',
    address_city: 'Rio de Janeiro',
    address_state: 'RJ',
    address_zipcode: '22410-002',
    bedrooms: 2,
    bathrooms: 2,
    parking_spots: 2,
    area_total: 100,
    area_built: 85,
    property_type: { id: 'type-1', name: 'Apartamento' },
    images: [{ id: 'img-2', url: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800', is_cover: true }],
    created_at: getDateOffset(-45),
    updated_at: getDateOffset(-2),
  },
  {
    id: 'demo-prop-3',
    title: 'Cobertura Duplex 4 Quartos',
    description: 'Cobertura espetacular com terraço gourmet, piscina privativa e vista 360° da cidade.',
    transaction_type: 'venda',
    status: 'com_proposta',
    sale_price: 2500000,
    rent_price: null,
    address_street: 'Av. Delfim Moreira',
    address_number: '400',
    address_neighborhood: 'Leblon',
    address_city: 'Rio de Janeiro',
    address_state: 'RJ',
    address_zipcode: '22441-000',
    bedrooms: 4,
    bathrooms: 5,
    parking_spots: 3,
    area_total: 350,
    area_built: 280,
    property_type: { id: 'type-2', name: 'Cobertura' },
    images: [{ id: 'img-3', url: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800', is_cover: true }],
    created_at: getDateOffset(-60),
    updated_at: getDateOffset(-10),
    launch_stage: 'pronto',
    property_condition: 'usado',
    beach_distance_meters: 100,
    development_name: 'Edifício Vista Mar',
    commission_type: 'valor',
    commission_value: 150000,
  },
  {
    id: 'demo-prop-4',
    title: 'Studio Moderno - Investimento',
    description: 'Studio compacto e moderno, ideal para investimento. Alta demanda de aluguel na região.',
    transaction_type: 'venda',
    status: 'suspenso',
    sale_price: 450000,
    rent_price: null,
    address_street: 'Rua Voluntários da Pátria',
    address_number: '200',
    address_neighborhood: 'Botafogo',
    address_city: 'Rio de Janeiro',
    address_state: 'RJ',
    address_zipcode: '22270-000',
    bedrooms: 1,
    bathrooms: 1,
    parking_spots: 0,
    area_total: 45,
    area_built: 40,
    property_type: { id: 'type-3', name: 'Studio' },
    images: [{ id: 'img-4', url: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800', is_cover: true }],
    created_at: getDateOffset(-20),
    updated_at: getDateOffset(-1),
    launch_stage: 'em_construcao',
    development_name: 'Residencial Botafogo Prime',
    property_condition: 'novo',
    iptu_monthly: 150,
  },
  {
    id: 'demo-prop-5',
    title: 'Apartamento 2 Quartos - Familiar',
    description: 'Apartamento aconchegante em bairro residencial. Próximo a escolas e comércio.',
    transaction_type: 'ambos',
    status: 'disponivel',
    sale_price: 380000,
    rent_price: 2500,
    address_street: 'Rua Conde de Bonfim',
    address_number: '1200',
    address_neighborhood: 'Tijuca',
    address_city: 'Rio de Janeiro',
    address_state: 'RJ',
    address_zipcode: '20520-054',
    bedrooms: 2,
    bathrooms: 1,
    parking_spots: 1,
    area_total: 70,
    area_built: 65,
    property_type: { id: 'type-1', name: 'Apartamento' },
    images: [{ id: 'img-5', url: 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800', is_cover: true }],
    created_at: getDateOffset(-15),
    updated_at: getDateOffset(-3),
  },
  // Casas (4)
  {
    id: 'demo-prop-6',
    title: 'Casa 4 Quartos - Condomínio Fechado',
    description: 'Casa ampla em condomínio fechado com segurança 24h. Piscina, churrasqueira e jardim.',
    transaction_type: 'venda',
    status: 'disponivel',
    sale_price: 1800000,
    rent_price: null,
    address_street: 'Av. das Américas',
    address_number: '15000',
    address_neighborhood: 'Barra da Tijuca',
    address_city: 'Rio de Janeiro',
    address_state: 'RJ',
    address_zipcode: '22640-102',
    bedrooms: 4,
    bathrooms: 4,
    parking_spots: 4,
    area_total: 500,
    area_built: 300,
    property_type: { id: 'type-4', name: 'Casa' },
    images: [{ id: 'img-6', url: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800', is_cover: true }],
    created_at: getDateOffset(-40),
    updated_at: getDateOffset(-7),
  },
  {
    id: 'demo-prop-7',
    title: 'Casa 3 Quartos - Praia do Recreio',
    description: 'Casa a 5 minutos da praia. Quintal espaçoso, ótimo para família com crianças.',
    transaction_type: 'venda',
    status: 'disponivel',
    sale_price: 950000,
    rent_price: null,
    address_street: 'Rua Silvia Pozzano',
    address_number: '300',
    address_neighborhood: 'Recreio dos Bandeirantes',
    address_city: 'Rio de Janeiro',
    address_state: 'RJ',
    address_zipcode: '22790-000',
    bedrooms: 3,
    bathrooms: 2,
    parking_spots: 2,
    area_total: 300,
    area_built: 180,
    property_type: { id: 'type-4', name: 'Casa' },
    images: [{ id: 'img-7', url: 'https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=800', is_cover: true }],
    created_at: getDateOffset(-25),
    updated_at: getDateOffset(-4),
  },
  {
    id: 'demo-prop-8',
    title: 'Mansão 5 Quartos - Jardim Botânico',
    description: 'Residência de luxo com arquitetura contemporânea. Vista para o Cristo Redentor.',
    transaction_type: 'venda',
    status: 'reservado',
    sale_price: 3200000,
    rent_price: null,
    address_street: 'Rua Jardim Botânico',
    address_number: '800',
    address_neighborhood: 'Jardim Botânico',
    address_city: 'Rio de Janeiro',
    address_state: 'RJ',
    address_zipcode: '22461-000',
    bedrooms: 5,
    bathrooms: 6,
    parking_spots: 4,
    area_total: 800,
    area_built: 500,
    property_type: { id: 'type-4', name: 'Casa' },
    images: [{ id: 'img-8', url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800', is_cover: true }],
    created_at: getDateOffset(-50),
    updated_at: getDateOffset(-1),
  },
  {
    id: 'demo-prop-9',
    title: 'Sobrado 3 Quartos - Reformado',
    description: 'Sobrado totalmente reformado. Excelente localização, próximo ao metrô.',
    transaction_type: 'venda',
    status: 'disponivel',
    sale_price: 720000,
    rent_price: null,
    address_street: 'Rua Barão de Mesquita',
    address_number: '500',
    address_neighborhood: 'Vila Isabel',
    address_city: 'Rio de Janeiro',
    address_state: 'RJ',
    address_zipcode: '20540-000',
    bedrooms: 3,
    bathrooms: 2,
    parking_spots: 1,
    area_total: 150,
    area_built: 120,
    property_type: { id: 'type-5', name: 'Sobrado' },
    images: [{ id: 'img-9', url: 'https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?w=800', is_cover: true }],
    created_at: getDateOffset(-18),
    updated_at: getDateOffset(-2),
  },
  // Comerciais (3)
  {
    id: 'demo-prop-10',
    title: 'Sala Comercial - Centro Empresarial',
    description: 'Sala comercial em edifício AAA. Ar-condicionado central, piso elevado.',
    transaction_type: 'venda',
    status: 'disponivel',
    sale_price: 280000,
    rent_price: null,
    address_street: 'Av. Rio Branco',
    address_number: '1',
    address_neighborhood: 'Centro',
    address_city: 'Rio de Janeiro',
    address_state: 'RJ',
    address_zipcode: '20090-003',
    bedrooms: 0,
    bathrooms: 1,
    parking_spots: 0,
    area_total: 50,
    area_built: 50,
    property_type: { id: 'type-6', name: 'Sala Comercial' },
    images: [{ id: 'img-10', url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800', is_cover: true }],
    created_at: getDateOffset(-35),
    updated_at: getDateOffset(-8),
  },
  {
    id: 'demo-prop-11',
    title: 'Loja de Rua - Alto Fluxo',
    description: 'Loja em galeria comercial movimentada. Ideal para varejo ou serviços.',
    transaction_type: 'venda',
    status: 'reservado',
    sale_price: 450000,
    rent_price: null,
    address_street: 'Rua Barata Ribeiro',
    address_number: '200',
    address_neighborhood: 'Copacabana',
    address_city: 'Rio de Janeiro',
    address_state: 'RJ',
    address_zipcode: '22040-000',
    bedrooms: 0,
    bathrooms: 1,
    parking_spots: 0,
    area_total: 80,
    area_built: 80,
    property_type: { id: 'type-7', name: 'Loja' },
    images: [{ id: 'img-11', url: 'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=800', is_cover: true }],
    created_at: getDateOffset(-28),
    updated_at: getDateOffset(-3),
  },
  {
    id: 'demo-prop-12',
    title: 'Galpão Industrial - Logística',
    description: 'Galpão com pé direito alto, docas para caminhões e escritório administrativo.',
    transaction_type: 'venda',
    status: 'disponivel',
    sale_price: 1100000,
    rent_price: null,
    address_street: 'Av. Brasil',
    address_number: '25000',
    address_neighborhood: 'Jacarepaguá',
    address_city: 'Rio de Janeiro',
    address_state: 'RJ',
    address_zipcode: '22775-000',
    bedrooms: 0,
    bathrooms: 2,
    parking_spots: 10,
    area_total: 2000,
    area_built: 1500,
    property_type: { id: 'type-8', name: 'Galpão' },
    images: [{ id: 'img-12', url: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800', is_cover: true }],
    created_at: getDateOffset(-22),
    updated_at: getDateOffset(-5),
  },
];

// ============= DEMO LEADS (27) =============

export const demoLeads: DemoLead[] = [
  // Novos (8)
  {
    id: 'demo-lead-1',
    name: 'Maria Silva',
    email: 'maria.silva@email.com',
    phone: '(21) 99999-1111',
    stage: 'novo',
    source: 'site',
    estimated_value: 850000,
    notes: 'Interesse em apartamento de 3 quartos em Copacabana',
    lead_type: { id: 'lt-1', name: 'Quente', color: '#ef4444' },
    lead_type_id: 'lt-1',
    property: { id: 'demo-prop-1', title: 'Apartamento 3 Quartos - Vista Mar' },
    property_id: 'demo-prop-1',
    broker: null,
    broker_id: null,
    interested_property_type: { id: 'type-1', name: 'Apartamento' },
    interested_property_type_id: 'type-1',
    is_active: true,
    created_at: getDateOffset(0),
    updated_at: getDateOffset(0),
  },
  {
    id: 'demo-lead-2',
    name: 'João Pereira',
    email: 'joao.pereira@email.com',
    phone: '(21) 99999-2222',
    stage: 'novo',
    source: 'Indicação',
    estimated_value: 2500,
    notes: 'Procura imóvel para locação, orçamento até R$3.000',
    lead_type: { id: 'lt-2', name: 'Morno', color: '#f59e0b' },
    property: null,
    broker: null,
    created_at: getDateOffset(-1),
    updated_at: getDateOffset(-1),
  },
  {
    id: 'demo-lead-3',
    name: 'Ana Costa',
    email: 'ana.costa@email.com',
    phone: '(21) 99999-3333',
    stage: 'novo',
    source: 'Instagram',
    estimated_value: 450000,
    notes: 'Primeiro imóvel, busca financiamento',
    lead_type: { id: 'lt-3', name: 'Frio', color: '#3b82f6' },
    property: { id: 'demo-prop-4', title: 'Studio Moderno - Investimento' },
    broker: null,
    created_at: getDateOffset(-2),
    updated_at: getDateOffset(-2),
  },
  {
    id: 'demo-lead-4',
    name: 'Carlos Mendes',
    email: 'carlos.mendes@email.com',
    phone: '(21) 99999-4444',
    stage: 'novo',
    source: 'Portal',
    estimated_value: 720000,
    notes: 'Interesse em sobrado na Zona Norte',
    lead_type: { id: 'lt-2', name: 'Morno', color: '#f59e0b' },
    property: { id: 'demo-prop-9', title: 'Sobrado 3 Quartos - Reformado' },
    broker: null,
    created_at: getDateOffset(-3),
    updated_at: getDateOffset(-3),
  },
  {
    id: 'demo-lead-5',
    name: 'Fernanda Lima',
    email: 'fernanda.lima@email.com',
    phone: '(21) 99999-5555',
    stage: 'novo',
    source: 'WhatsApp',
    estimated_value: 950000,
    notes: 'Família com 2 filhos, precisa de casa com quintal',
    lead_type: { id: 'lt-1', name: 'Quente', color: '#ef4444' },
    property: { id: 'demo-prop-7', title: 'Casa 3 Quartos - Praia do Recreio' },
    broker: null,
    created_at: getDateOffset(-3),
    updated_at: getDateOffset(-3),
  },
  {
    id: 'demo-lead-6',
    name: 'Ricardo Santos',
    email: 'ricardo.santos@email.com',
    phone: '(21) 99999-6666',
    stage: 'novo',
    source: 'Site',
    estimated_value: 280000,
    notes: 'Empresário buscando sala comercial',
    lead_type: { id: 'lt-2', name: 'Morno', color: '#f59e0b' },
    property: { id: 'demo-prop-10', title: 'Sala Comercial - Centro Empresarial' },
    broker: null,
    created_at: getDateOffset(-4),
    updated_at: getDateOffset(-4),
  },
  {
    id: 'demo-lead-7',
    name: 'Patricia Oliveira',
    email: 'patricia.oliveira@email.com',
    phone: '(21) 99999-7777',
    stage: 'novo',
    source: 'Indicação',
    estimated_value: 380000,
    notes: 'Jovem casal, primeiro imóvel próprio',
    lead_type: { id: 'lt-3', name: 'Frio', color: '#3b82f6' },
    property: { id: 'demo-prop-5', title: 'Apartamento 2 Quartos - Familiar' },
    broker: null,
    created_at: getDateOffset(-5),
    updated_at: getDateOffset(-5),
  },
  {
    id: 'demo-lead-8',
    name: 'Bruno Almeida',
    email: 'bruno.almeida@email.com',
    phone: '(21) 99999-8888',
    stage: 'novo',
    source: 'Portal',
    estimated_value: 1100000,
    notes: 'Investidor buscando galpão logístico',
    lead_type: { id: 'lt-2', name: 'Morno', color: '#f59e0b' },
    property: { id: 'demo-prop-12', title: 'Galpão Industrial - Logística' },
    broker: null,
    created_at: getDateOffset(-6),
    updated_at: getDateOffset(-6),
  },
  // Em Contato (6)
  {
    id: 'demo-lead-9',
    name: 'Roberto Santos',
    email: 'roberto.santos@email.com',
    phone: '(21) 99998-1111',
    stage: 'contato',
    source: 'Site',
    estimated_value: 1200000,
    notes: 'Aguardando proposta detalhada do apt Ipanema',
    lead_type: { id: 'lt-1', name: 'Quente', color: '#ef4444' },
    property: { id: 'demo-prop-2', title: 'Apartamento 2 Quartos - Alto Padrão' },
    broker: { id: 'demo-broker-1', full_name: 'Carlos Corretor' },
    created_at: getDateOffset(-7),
    updated_at: getDateOffset(-1),
  },
  {
    id: 'demo-lead-10',
    name: 'Lucia Ferreira',
    email: 'lucia.ferreira@email.com',
    phone: '(21) 99998-2222',
    stage: 'contato',
    source: 'Instagram',
    estimated_value: 850000,
    notes: 'Analisando opções em Copacabana e Ipanema',
    lead_type: { id: 'lt-2', name: 'Morno', color: '#f59e0b' },
    property: null,
    broker: { id: 'demo-broker-1', full_name: 'Carlos Corretor' },
    created_at: getDateOffset(-8),
    updated_at: getDateOffset(-2),
  },
  {
    id: 'demo-lead-11',
    name: 'André Martins',
    email: 'andre.martins@email.com',
    phone: '(21) 99998-3333',
    stage: 'contato',
    source: 'Portal',
    estimated_value: 1800000,
    notes: 'Interesse em casa na Barra com piscina',
    lead_type: { id: 'lt-1', name: 'Quente', color: '#ef4444' },
    property: { id: 'demo-prop-6', title: 'Casa 4 Quartos - Condomínio Fechado' },
    broker: { id: 'demo-broker-2', full_name: 'Ana Corretora' },
    created_at: getDateOffset(-10),
    updated_at: getDateOffset(-3),
  },
  {
    id: 'demo-lead-12',
    name: 'Mariana Costa',
    email: 'mariana.costa@email.com',
    phone: '(21) 99998-4444',
    stage: 'contato',
    source: 'WhatsApp',
    estimated_value: 450000,
    notes: 'Investidora, quer saber sobre rentabilidade',
    lead_type: { id: 'lt-2', name: 'Morno', color: '#f59e0b' },
    property: { id: 'demo-prop-4', title: 'Studio Moderno - Investimento' },
    broker: { id: 'demo-broker-1', full_name: 'Carlos Corretor' },
    created_at: getDateOffset(-12),
    updated_at: getDateOffset(-4),
  },
  {
    id: 'demo-lead-13',
    name: 'Felipe Rodrigues',
    email: 'felipe.rodrigues@email.com',
    phone: '(21) 99998-5555',
    stage: 'contato',
    source: 'Indicação',
    estimated_value: 2500000,
    notes: 'Alto padrão, busca cobertura ou casa grande',
    lead_type: { id: 'lt-1', name: 'Quente', color: '#ef4444' },
    property: { id: 'demo-prop-3', title: 'Cobertura Duplex 4 Quartos' },
    broker: { id: 'demo-broker-2', full_name: 'Ana Corretora' },
    created_at: getDateOffset(-14),
    updated_at: getDateOffset(-5),
  },
  {
    id: 'demo-lead-14',
    name: 'Carla Nunes',
    email: 'carla.nunes@email.com',
    phone: '(21) 99998-6666',
    stage: 'contato',
    source: 'Site',
    estimated_value: 450000,
    notes: 'Interesse em loja para abrir boutique',
    lead_type: { id: 'lt-2', name: 'Morno', color: '#f59e0b' },
    property: { id: 'demo-prop-11', title: 'Loja de Rua - Alto Fluxo' },
    broker: { id: 'demo-broker-1', full_name: 'Carlos Corretor' },
    created_at: getDateOffset(-15),
    updated_at: getDateOffset(-6),
  },
  // Visita (4)
  {
    id: 'demo-lead-15',
    name: 'Carlos Eduardo',
    email: 'carlos.eduardo@email.com',
    phone: '(21) 99997-1111',
    stage: 'visita',
    source: 'Site',
    estimated_value: 1200000,
    notes: 'Visita agendada para amanhã às 14h',
    lead_type: { id: 'lt-1', name: 'Quente', color: '#ef4444' },
    property: { id: 'demo-prop-2', title: 'Apartamento 2 Quartos - Alto Padrão' },
    broker: { id: 'demo-broker-1', full_name: 'Carlos Corretor' },
    created_at: getDateOffset(-18),
    updated_at: getDateOffset(0),
  },
  {
    id: 'demo-lead-16',
    name: 'Patricia Mendes',
    email: 'patricia.mendes@email.com',
    phone: '(21) 99997-2222',
    stage: 'visita',
    source: 'Indicação',
    estimated_value: 950000,
    notes: 'Segunda visita agendada, muito interessada',
    lead_type: { id: 'lt-1', name: 'Quente', color: '#ef4444' },
    property: { id: 'demo-prop-7', title: 'Casa 3 Quartos - Praia do Recreio' },
    broker: { id: 'demo-broker-2', full_name: 'Ana Corretora' },
    created_at: getDateOffset(-20),
    updated_at: getDateOffset(-1),
  },
  {
    id: 'demo-lead-17',
    name: 'Gustavo Lima',
    email: 'gustavo.lima@email.com',
    phone: '(21) 99997-3333',
    stage: 'visita',
    source: 'Portal',
    estimated_value: 850000,
    notes: 'Visita realizada, aguardando feedback',
    lead_type: { id: 'lt-2', name: 'Morno', color: '#f59e0b' },
    property: { id: 'demo-prop-1', title: 'Apartamento 3 Quartos - Vista Mar' },
    broker: { id: 'demo-broker-1', full_name: 'Carlos Corretor' },
    created_at: getDateOffset(-22),
    updated_at: getDateOffset(-2),
  },
  {
    id: 'demo-lead-18',
    name: 'Renata Souza',
    email: 'renata.souza@email.com',
    phone: '(21) 99997-4444',
    stage: 'visita',
    source: 'Instagram',
    estimated_value: 1800000,
    notes: 'Visita confirmada para sábado',
    lead_type: { id: 'lt-1', name: 'Quente', color: '#ef4444' },
    property: { id: 'demo-prop-6', title: 'Casa 4 Quartos - Condomínio Fechado' },
    broker: { id: 'demo-broker-2', full_name: 'Ana Corretora' },
    created_at: getDateOffset(-24),
    updated_at: getDateOffset(-3),
  },
  // Proposta (3)
  {
    id: 'demo-lead-19',
    name: 'Marcelo Souza',
    email: 'marcelo.souza@email.com',
    phone: '(21) 99996-1111',
    stage: 'proposta',
    source: 'Site',
    estimated_value: 850000,
    notes: 'Proposta enviada, aguardando resposta',
    lead_type: { id: 'lt-1', name: 'Quente', color: '#ef4444' },
    property: { id: 'demo-prop-1', title: 'Apartamento 3 Quartos - Vista Mar' },
    broker: { id: 'demo-broker-1', full_name: 'Carlos Corretor' },
    created_at: getDateOffset(-28),
    updated_at: getDateOffset(-1),
  },
  {
    id: 'demo-lead-20',
    name: 'Juliana Oliveira',
    email: 'juliana.oliveira@email.com',
    phone: '(21) 99996-2222',
    stage: 'proposta',
    source: 'Indicação',
    estimated_value: 720000,
    notes: 'Proposta de R$700k, cliente aguardando contraproposta',
    lead_type: { id: 'lt-1', name: 'Quente', color: '#ef4444' },
    property: { id: 'demo-prop-9', title: 'Sobrado 3 Quartos - Reformado' },
    broker: { id: 'demo-broker-2', full_name: 'Ana Corretora' },
    created_at: getDateOffset(-30),
    updated_at: getDateOffset(-2),
  },
  {
    id: 'demo-lead-21',
    name: 'Eduardo Ferreira',
    email: 'eduardo.ferreira@email.com',
    phone: '(21) 99996-3333',
    stage: 'proposta',
    source: 'Portal',
    estimated_value: 450000,
    notes: 'Proposta aceita, preparando documentação',
    lead_type: { id: 'lt-1', name: 'Quente', color: '#ef4444' },
    property: { id: 'demo-prop-4', title: 'Studio Moderno - Investimento' },
    broker: { id: 'demo-broker-1', full_name: 'Carlos Corretor' },
    created_at: getDateOffset(-32),
    updated_at: getDateOffset(-3),
  },
  // Negociação (2)
  {
    id: 'demo-lead-22',
    name: 'Ricardo Alves',
    email: 'ricardo.alves@email.com',
    phone: '(21) 99995-1111',
    stage: 'negociacao',
    source: 'Site',
    estimated_value: 1200000,
    notes: 'Negociando valor e forma de pagamento',
    lead_type: { id: 'lt-1', name: 'Quente', color: '#ef4444' },
    property: { id: 'demo-prop-2', title: 'Apartamento 2 Quartos - Alto Padrão' },
    broker: { id: 'demo-broker-1', full_name: 'Carlos Corretor' },
    created_at: getDateOffset(-35),
    updated_at: getDateOffset(0),
  },
  {
    id: 'demo-lead-23',
    name: 'Beatriz Santos',
    email: 'beatriz.santos@email.com',
    phone: '(21) 99995-2222',
    stage: 'negociacao',
    source: 'Indicação',
    estimated_value: 3200000,
    notes: 'Condições finais sendo definidas, previsão de fechamento esta semana',
    lead_type: { id: 'lt-1', name: 'Quente', color: '#ef4444' },
    property: { id: 'demo-prop-8', title: 'Mansão 5 Quartos - Jardim Botânico' },
    broker: { id: 'demo-broker-2', full_name: 'Ana Corretora' },
    created_at: getDateOffset(-38),
    updated_at: getDateOffset(-1),
  },
  // Fechado Ganho (3)
  {
    id: 'demo-lead-24',
    name: 'Pedro Augusto',
    email: 'pedro.augusto@email.com',
    phone: '(21) 99994-1111',
    stage: 'fechado_ganho',
    source: 'Site',
    estimated_value: 850000,
    notes: 'Contrato assinado! Venda concluída com sucesso.',
    lead_type: { id: 'lt-1', name: 'Quente', color: '#ef4444' },
    property: { id: 'demo-prop-1', title: 'Apartamento 3 Quartos - Vista Mar' },
    broker: { id: 'demo-broker-1', full_name: 'Carlos Corretor' },
    created_at: getDateOffset(-45),
    updated_at: getDateOffset(-2),
  },
  {
    id: 'demo-lead-25',
    name: 'Camila Ferreira',
    email: 'camila.ferreira@email.com',
    phone: '(21) 99994-2222',
    stage: 'fechado_ganho',
    source: 'Portal',
    estimated_value: 1800000,
    notes: 'Venda finalizada. Cliente muito satisfeita.',
    lead_type: { id: 'lt-1', name: 'Quente', color: '#ef4444' },
    property: { id: 'demo-prop-6', title: 'Casa 4 Quartos - Condomínio Fechado' },
    broker: { id: 'demo-broker-2', full_name: 'Ana Corretora' },
    created_at: getDateOffset(-50),
    updated_at: getDateOffset(-5),
  },
  {
    id: 'demo-lead-26',
    name: 'Thiago Ribeiro',
    email: 'thiago.ribeiro@email.com',
    phone: '(21) 99994-3333',
    stage: 'fechado_ganho',
    source: 'Indicação',
    estimated_value: 950000,
    notes: 'Negócio fechado! Indicou 2 amigos.',
    lead_type: { id: 'lt-1', name: 'Quente', color: '#ef4444' },
    property: { id: 'demo-prop-7', title: 'Casa 3 Quartos - Praia do Recreio' },
    broker: { id: 'demo-broker-1', full_name: 'Carlos Corretor' },
    created_at: getDateOffset(-55),
    updated_at: getDateOffset(-8),
  },
  // Fechado Perdido (1)
  {
    id: 'demo-lead-27',
    name: 'Lucas Martins',
    email: 'lucas.martins@email.com',
    phone: '(21) 99993-1111',
    stage: 'fechado_perdido',
    source: 'Site',
    estimated_value: 450000,
    notes: 'Desistiu da compra por motivos pessoais. Manter contato para futuro.',
    lead_type: { id: 'lt-3', name: 'Frio', color: '#3b82f6' },
    property: { id: 'demo-prop-4', title: 'Studio Moderno - Investimento' },
    broker: { id: 'demo-broker-1', full_name: 'Carlos Corretor' },
    created_at: getDateOffset(-40),
    updated_at: getDateOffset(-15),
  },
];

// ============= DEMO CONTRACTS (4) =============

export const demoContracts: DemoContract[] = [
  {
    id: 'demo-contract-1',
    code: 'CONT-2026-0001',
    type: 'venda',
    status: 'ativo',
    value: 850000,
    commission_percentage: 5,
    start_date: getDateOffset(-30),
    end_date: null,
    property: { id: 'demo-prop-1', title: 'Apartamento 3 Quartos - Vista Mar' },
    lead: { id: 'demo-lead-24', name: 'Pedro Augusto' },
    broker: { id: 'demo-broker-1', full_name: 'Carlos Corretor' },
    created_at: getDateOffset(-30),
  },
  {
    id: 'demo-contract-2',
    code: 'CONT-2026-0002',
    type: 'venda',
    status: 'ativo',
    value: 1800000,
    commission_percentage: 5,
    start_date: getDateOffset(-20),
    end_date: null,
    property: { id: 'demo-prop-6', title: 'Casa 4 Quartos - Condomínio Fechado' },
    lead: { id: 'demo-lead-25', name: 'Camila Ferreira' },
    broker: { id: 'demo-broker-2', full_name: 'Ana Corretora' },
    created_at: getDateOffset(-20),
  },
  {
    id: 'demo-contract-3',
    code: 'CONT-2026-0003',
    type: 'locacao',
    status: 'ativo',
    value: 2500,
    commission_percentage: 10,
    start_date: getDateOffset(-15),
    end_date: getDateOffset(350),
    property: { id: 'demo-prop-5', title: 'Apartamento 2 Quartos - Familiar' },
    lead: { id: 'demo-lead-7', name: 'Patricia Oliveira' },
    broker: { id: 'demo-broker-1', full_name: 'Carlos Corretor' },
    created_at: getDateOffset(-15),
  },
  {
    id: 'demo-contract-4',
    code: 'CONT-2026-0004',
    type: 'venda',
    status: 'rascunho',
    value: 950000,
    commission_percentage: 5,
    start_date: null,
    end_date: null,
    property: { id: 'demo-prop-7', title: 'Casa 3 Quartos - Praia do Recreio' },
    lead: { id: 'demo-lead-26', name: 'Thiago Ribeiro' },
    broker: { id: 'demo-broker-1', full_name: 'Carlos Corretor' },
    created_at: getDateOffset(-10),
  },
];

// ============= DEMO TRANSACTIONS (15+) =============

export const demoTransactions: DemoTransaction[] = [
  // Receitas
  {
    id: 'demo-trans-1',
    type: 'receita',
    description: 'Comissão - Venda Apt Copacabana',
    amount: 42500,
    date: getDateOffset(-28),
    paid: true,
    paid_at: getDateOffset(-25),
    category: { id: 'cat-1', name: 'Comissões' },
    contract: { id: 'demo-contract-1', code: 'CONT-2026-0001' },
    created_at: getDateOffset(-28),
  },
  {
    id: 'demo-trans-2',
    type: 'receita',
    description: 'Comissão - Venda Casa Barra',
    amount: 90000,
    date: getDateOffset(-18),
    paid: true,
    paid_at: getDateOffset(-15),
    category: { id: 'cat-1', name: 'Comissões' },
    contract: { id: 'demo-contract-2', code: 'CONT-2026-0002' },
    created_at: getDateOffset(-18),
  },
  {
    id: 'demo-trans-3',
    type: 'receita',
    description: 'Taxa administrativa - Locação',
    amount: 2500,
    date: getDateOffset(-12),
    paid: true,
    paid_at: getDateOffset(-10),
    category: { id: 'cat-2', name: 'Taxas Administrativas' },
    contract: { id: 'demo-contract-3', code: 'CONT-2026-0003' },
    created_at: getDateOffset(-12),
  },
  {
    id: 'demo-trans-4',
    type: 'receita',
    description: 'Comissão - Venda Casa Recreio (pendente)',
    amount: 47500,
    date: getDateOffset(-5),
    paid: false,
    paid_at: null,
    category: { id: 'cat-1', name: 'Comissões' },
    contract: { id: 'demo-contract-4', code: 'CONT-2026-0004' },
    created_at: getDateOffset(-5),
  },
  {
    id: 'demo-trans-5',
    type: 'receita',
    description: 'Aluguel mensal - Apt Tijuca',
    amount: 2500,
    date: getDateOffset(-2),
    paid: true,
    paid_at: getDateOffset(-1),
    category: { id: 'cat-3', name: 'Aluguéis' },
    contract: { id: 'demo-contract-3', code: 'CONT-2026-0003' },
    created_at: getDateOffset(-2),
  },
  // Despesas
  {
    id: 'demo-trans-6',
    type: 'despesa',
    description: 'Marketing - Anúncios portais',
    amount: 3500,
    date: getDateOffset(-25),
    paid: true,
    paid_at: getDateOffset(-25),
    category: { id: 'cat-4', name: 'Marketing' },
    contract: null,
    created_at: getDateOffset(-25),
  },
  {
    id: 'demo-trans-7',
    type: 'despesa',
    description: 'Aluguel escritório',
    amount: 4500,
    date: getDateOffset(-20),
    paid: true,
    paid_at: getDateOffset(-20),
    category: { id: 'cat-5', name: 'Aluguel' },
    contract: null,
    created_at: getDateOffset(-20),
  },
  {
    id: 'demo-trans-8',
    type: 'despesa',
    description: 'Contas de serviços (água, luz, internet)',
    amount: 850,
    date: getDateOffset(-18),
    paid: true,
    paid_at: getDateOffset(-18),
    category: { id: 'cat-6', name: 'Utilidades' },
    contract: null,
    created_at: getDateOffset(-18),
  },
  {
    id: 'demo-trans-9',
    type: 'despesa',
    description: 'Fotografia profissional - 5 imóveis',
    amount: 2000,
    date: getDateOffset(-15),
    paid: true,
    paid_at: getDateOffset(-15),
    category: { id: 'cat-4', name: 'Marketing' },
    contract: null,
    created_at: getDateOffset(-15),
  },
  {
    id: 'demo-trans-10',
    type: 'despesa',
    description: 'Combustível - Visitas',
    amount: 600,
    date: getDateOffset(-12),
    paid: true,
    paid_at: getDateOffset(-12),
    category: { id: 'cat-7', name: 'Transporte' },
    contract: null,
    created_at: getDateOffset(-12),
  },
  {
    id: 'demo-trans-11',
    type: 'despesa',
    description: 'Software CRM - Mensalidade',
    amount: 299,
    date: getDateOffset(-10),
    paid: true,
    paid_at: getDateOffset(-10),
    category: { id: 'cat-8', name: 'Software' },
    contract: null,
    created_at: getDateOffset(-10),
  },
  {
    id: 'demo-trans-12',
    type: 'despesa',
    description: 'Contador - Honorários',
    amount: 1200,
    date: getDateOffset(-8),
    paid: true,
    paid_at: getDateOffset(-8),
    category: { id: 'cat-9', name: 'Serviços Profissionais' },
    contract: null,
    created_at: getDateOffset(-8),
  },
  {
    id: 'demo-trans-13',
    type: 'despesa',
    description: 'Material de escritório',
    amount: 350,
    date: getDateOffset(-5),
    paid: true,
    paid_at: getDateOffset(-5),
    category: { id: 'cat-10', name: 'Material' },
    contract: null,
    created_at: getDateOffset(-5),
  },
  {
    id: 'demo-trans-14',
    type: 'despesa',
    description: 'Aluguel escritório (próximo mês)',
    amount: 4500,
    date: getDateOffset(5),
    paid: false,
    paid_at: null,
    category: { id: 'cat-5', name: 'Aluguel' },
    contract: null,
    created_at: getDateOffset(-2),
  },
  {
    id: 'demo-trans-15',
    type: 'despesa',
    description: 'Marketing - Google Ads',
    amount: 1500,
    date: getDateOffset(3),
    paid: false,
    paid_at: null,
    category: { id: 'cat-4', name: 'Marketing' },
    contract: null,
    created_at: getDateOffset(-1),
  },
];

// ============= DEMO TASKS (6) =============

export const demoTasks: DemoTask[] = [
  {
    id: 'demo-task-1',
    title: 'Follow-up: Roberto Santos',
    description: 'Ligar para confirmar interesse no apt Ipanema',
    due_date: getTodayAt(9, 0),
    priority: 'alta',
    completed: false,
    completed_at: null,
    lead: { id: 'demo-lead-9', name: 'Roberto Santos' },
    created_at: getDateOffset(-2),
  },
  {
    id: 'demo-task-2',
    title: 'Ligar para Fernanda Lima',
    description: 'Verificar disponibilidade para visita',
    due_date: getTodayAt(10, 30),
    priority: 'media',
    completed: false,
    completed_at: null,
    lead: { id: 'demo-lead-5', name: 'Fernanda Lima' },
    created_at: getDateOffset(-1),
  },
  {
    id: 'demo-task-3',
    title: 'Enviar proposta: Marcelo Souza',
    description: 'Finalizar e enviar proposta formal por email',
    due_date: getTodayAt(16, 0),
    priority: 'alta',
    completed: false,
    completed_at: null,
    lead: { id: 'demo-lead-19', name: 'Marcelo Souza' },
    created_at: getDateOffset(-3),
  },
  {
    id: 'demo-task-4',
    title: 'Atualizar fotos do apt Leblon',
    description: 'Agendar fotógrafo para novas fotos',
    due_date: getDateOffset(1),
    priority: 'baixa',
    completed: false,
    completed_at: null,
    lead: null,
    created_at: getDateOffset(-5),
  },
  {
    id: 'demo-task-5',
    title: 'Reunião de equipe',
    description: 'Alinhamento semanal com corretores',
    due_date: getTodayAt(8, 0),
    priority: 'media',
    completed: true,
    completed_at: getTodayAt(8, 45),
    lead: null,
    created_at: getDateOffset(-7),
  },
  {
    id: 'demo-task-6',
    title: 'Preparar relatório mensal',
    description: 'Compilar vendas e comissões do mês',
    due_date: getDateOffset(3),
    priority: 'media',
    completed: false,
    completed_at: null,
    lead: null,
    created_at: getDateOffset(-4),
  },
];

// ============= DEMO APPOINTMENTS (4) =============

export const demoAppointments: DemoAppointment[] = [
  {
    id: 'demo-apt-1',
    title: 'Visita: Apt Ipanema',
    description: 'Segunda visita com Carlos Eduardo',
    start_time: getTodayAt(14, 0),
    end_time: getTodayAt(15, 0),
    location: 'Rua Visconde de Pirajá, 800 - Ipanema',
    completed: false,
    lead: { id: 'demo-lead-15', name: 'Carlos Eduardo' },
    property: { id: 'demo-prop-2', title: 'Apartamento 2 Quartos - Alto Padrão' },
    created_at: getDateOffset(-2),
  },
  {
    id: 'demo-apt-2',
    title: 'Visita: Casa Recreio',
    description: 'Família com 2 filhos, mostrar área externa',
    start_time: getDateOffset(1) + 'T10:00:00.000Z',
    end_time: getDateOffset(1) + 'T11:30:00.000Z',
    location: 'Rua Silvia Pozzano, 300 - Recreio',
    completed: false,
    lead: { id: 'demo-lead-16', name: 'Patricia Mendes' },
    property: { id: 'demo-prop-7', title: 'Casa 3 Quartos - Praia do Recreio' },
    created_at: getDateOffset(-1),
  },
  {
    id: 'demo-apt-3',
    title: 'Reunião: Negociação final',
    description: 'Definir termos finais com Beatriz Santos',
    start_time: getDateOffset(2) + 'T15:00:00.000Z',
    end_time: getDateOffset(2) + 'T16:00:00.000Z',
    location: 'Escritório',
    completed: false,
    lead: { id: 'demo-lead-23', name: 'Beatriz Santos' },
    property: { id: 'demo-prop-8', title: 'Mansão 5 Quartos - Jardim Botânico' },
    created_at: getDateOffset(-3),
  },
  {
    id: 'demo-apt-4',
    title: 'Visita: Casa Barra',
    description: 'Cliente quer ver piscina e área de lazer',
    start_time: getDateOffset(3) + 'T09:00:00.000Z',
    end_time: getDateOffset(3) + 'T10:30:00.000Z',
    location: 'Av. das Américas, 15000 - Barra',
    completed: false,
    lead: { id: 'demo-lead-18', name: 'Renata Souza' },
    property: { id: 'demo-prop-6', title: 'Casa 4 Quartos - Condomínio Fechado' },
    created_at: getDateOffset(-4),
  },
];

// ============= DEMO ACTIVITIES (Recent) =============

export const demoActivities: DemoActivity[] = [
  {
    id: 'demo-activity-1',
    type: 'lead_created',
    title: 'Novo lead: Maria Silva',
    description: 'Interesse em apartamento 3 quartos em Copacabana',
    timestamp: getDateOffset(0),
    icon: 'user',
  },
  {
    id: 'demo-activity-2',
    type: 'contract_signed',
    title: 'Contrato assinado: Pedro Augusto',
    description: 'Venda do Apt 3 Quartos - Vista Mar',
    timestamp: getDateOffset(-1),
    icon: 'file',
  },
  {
    id: 'demo-activity-3',
    type: 'appointment_scheduled',
    title: 'Visita agendada: Carlos Eduardo',
    description: 'Apt Ipanema - Hoje às 14h',
    timestamp: getDateOffset(-1),
    icon: 'calendar',
  },
  {
    id: 'demo-activity-4',
    type: 'commission_received',
    title: 'Comissão recebida',
    description: 'R$ 8.500 - Venda Casa Barra',
    timestamp: getDateOffset(-2),
    icon: 'dollar',
  },
  {
    id: 'demo-activity-5',
    type: 'property_created',
    title: 'Imóvel cadastrado',
    description: 'Studio Moderno - Botafogo',
    timestamp: getDateOffset(-3),
    icon: 'home',
  },
  {
    id: 'demo-activity-6',
    type: 'task_completed',
    title: 'Tarefa concluída',
    description: 'Reunião de equipe - Alinhamento semanal',
    timestamp: getTodayAt(8, 45),
    icon: 'check',
  },
];

// ============= CALCULATED STATS =============

export function calculateDemoStats() {
  const activeProperties = demoProperties.filter(p => p.status === 'disponivel' || p.status === 'reservado').length;
  const totalLeads = demoLeads.length;
  const activeLeads = demoLeads.filter(l => !['fechado_ganho', 'fechado_perdido'].includes(l.stage)).length;
  const activeContracts = demoContracts.filter(c => c.status === 'ativo').length;
  
  const paidRevenue = demoTransactions
    .filter(t => t.type === 'receita' && t.paid)
    .reduce((sum, t) => sum + t.amount, 0);
  
  const paidExpenses = demoTransactions
    .filter(t => t.type === 'despesa' && t.paid)
    .reduce((sum, t) => sum + t.amount, 0);
  
  const monthlyRevenue = paidRevenue;
  
  const pipelineValue = demoLeads
    .filter(l => !['fechado_ganho', 'fechado_perdido'].includes(l.stage))
    .reduce((sum, l) => sum + (l.estimated_value || 0), 0);
  
  const wonLeads = demoLeads.filter(l => l.stage === 'fechado_ganho').length;
  const totalClosedLeads = demoLeads.filter(l => ['fechado_ganho', 'fechado_perdido'].includes(l.stage)).length;
  const conversionRate = totalClosedLeads > 0 ? (wonLeads / totalClosedLeads) * 100 : 0;
  
  const closedValue = demoLeads
    .filter(l => l.stage === 'fechado_ganho')
    .reduce((sum, l) => sum + (l.estimated_value || 0), 0);

  return {
    totalProperties: demoProperties.length,
    activeProperties,
    totalLeads,
    activeLeads,
    newLeadsThisWeek: 8,
    activeContracts,
    pendingContracts: demoContracts.filter(c => c.status === 'rascunho').length,
    monthlyRevenue,
    monthlyExpenses: paidExpenses,
    balance: paidRevenue - paidExpenses,
    pipelineValue,
    conversionRate: Math.round(conversionRate),
    closedValue,
  };
}

export function getTodayDemoTasks() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  return demoTasks.filter(t => {
    if (!t.due_date) return false;
    const dueDate = new Date(t.due_date);
    return dueDate >= today && dueDate < tomorrow;
  });
}

export function getTodayDemoAppointments() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  return demoAppointments.filter(a => {
    const startTime = new Date(a.start_time);
    return startTime >= today && startTime < tomorrow;
  });
}
