export const DEMO_PASSWORD = 'senha1234';

interface SeedProduct {
  name: string;
  description: string;
  price: number;
  category: string;
}

interface SeedCompany {
  name: string;
  inviteCode: string;
  slug: string;
  products: SeedProduct[];
}

export const companies: SeedCompany[] = [
  {
    name: 'TechNova Eletrônicos',
    slug: 'technova',
    inviteCode: 'technova-demo',
    products: [
      {
        name: 'Smartphone Nova X12',
        description: 'Tela AMOLED de 6,5", 128 GB, câmera tripla de 50 MP e bateria de 5000 mAh.',
        price: 1899.9,
        category: 'Celulares',
      },
      {
        name: 'Smartphone Nova Lite',
        description: 'Tela de 6,1", 64 GB, ideal para uso básico com ótima autonomia.',
        price: 899.0,
        category: 'Celulares',
      },
      {
        name: 'Notebook Pro 14',
        description: 'Intel Core i7, 16 GB de RAM, SSD de 512 GB e tela Full HD de 14".',
        price: 5499.0,
        category: 'Computadores',
      },
      {
        name: 'Notebook Essencial 15',
        description: 'Processador Ryzen 5, 8 GB de RAM, SSD de 256 GB, ótimo para estudos.',
        price: 2999.0,
        category: 'Computadores',
      },
      {
        name: 'Fone Bluetooth Air',
        description: 'Fone sem fio com cancelamento de ruído e até 24 horas de bateria.',
        price: 349.9,
        category: 'Áudio',
      },
      {
        name: 'Caixa de Som Boom Mini',
        description: 'Caixa portátil resistente à água, 12 horas de bateria e som estéreo.',
        price: 229.0,
        category: 'Áudio',
      },
      {
        name: 'Smartwatch Pulse',
        description: 'Monitor cardíaco, GPS integrado, resistência à água de 5 ATM.',
        price: 799.0,
        category: 'Wearables',
      },
      {
        name: 'Pulseira Fit Band 6',
        description: 'Contador de passos, monitor de sono e bateria de até 14 dias.',
        price: 189.9,
        category: 'Wearables',
      },
      {
        name: 'Monitor Gamer 27" 165Hz',
        description: 'Painel IPS QHD, 1 ms de resposta e taxa de atualização de 165 Hz.',
        price: 1699.0,
        category: 'Periféricos',
      },
      {
        name: 'Teclado Mecânico RGB',
        description: 'Switches vermelhos, iluminação RGB e layout ABNT2.',
        price: 329.9,
        category: 'Periféricos',
      },
      {
        name: 'Mouse Sem Fio Ergo',
        description: 'Mouse ergonômico, 1600 DPI, conexão Bluetooth e USB receiver.',
        price: 119.9,
        category: 'Periféricos',
      },
      {
        name: 'Carregador Turbo 65W',
        description: 'Carregador USB-C GaN com duas portas, compatível com notebooks e celulares.',
        price: 149.0,
        category: 'Acessórios',
      },
      {
        name: 'Cabo USB-C Reforçado 2m',
        description: 'Cabo trançado com suporte a carregamento rápido e transferência de dados.',
        price: 39.9,
        category: 'Acessórios',
      },
    ],
  },
  {
    name: 'Casa & Aroma',
    slug: 'casaaroma',
    inviteCode: 'casaaroma-demo',
    products: [
      {
        name: 'Vela Aromática Lavanda',
        description: 'Vela de cera de soja com aroma de lavanda, queima de até 40 horas.',
        price: 49.9,
        category: 'Velas e Aromas',
      },
      {
        name: 'Vela Aromática Baunilha',
        description: 'Vela perfumada de baunilha em pote de vidro, 200 g.',
        price: 54.9,
        category: 'Velas e Aromas',
      },
      {
        name: 'Difusor de Ambiente Bambu',
        description: 'Difusor com varetas, essência de bambu e chá verde, 250 ml.',
        price: 79.0,
        category: 'Velas e Aromas',
      },
      {
        name: 'Jogo de Cama Queen 400 fios',
        description: 'Lençol, fronhas e capa de edredom em algodão egípcio, cor cinza.',
        price: 389.0,
        category: 'Cama e Banho',
      },
      {
        name: 'Toalha de Banho Felpuda',
        description: 'Toalha 100% algodão, 500 g/m², toque macio e alta absorção.',
        price: 69.9,
        category: 'Cama e Banho',
      },
      {
        name: 'Roupão Microfibra',
        description: 'Roupão unissex com capuz, secagem rápida, tamanhos M e G.',
        price: 159.9,
        category: 'Cama e Banho',
      },
      {
        name: 'Vaso de Cerâmica Artesanal',
        description: 'Vaso decorativo feito à mão, acabamento fosco, 30 cm de altura.',
        price: 119.0,
        category: 'Decoração',
      },
      {
        name: 'Quadro Abstrato 60x40',
        description: 'Impressão em tela com moldura de madeira, tons terrosos.',
        price: 189.0,
        category: 'Decoração',
      },
      {
        name: 'Luminária de Mesa Nórdica',
        description: 'Luminária com base de madeira e cúpula de linho, lâmpada LED inclusa.',
        price: 139.9,
        category: 'Decoração',
      },
      {
        name: 'Jogo de Panelas Antiaderente 5 peças',
        description: 'Panelas com revestimento antiaderente e cabos de silicone.',
        price: 449.0,
        category: 'Cozinha',
      },
      {
        name: 'Conjunto de Facas Inox',
        description: 'Seis facas de aço inoxidável com cepo de madeira.',
        price: 219.9,
        category: 'Cozinha',
      },
      {
        name: 'Jarra de Vidro 1,5 L',
        description: 'Jarra de vidro borossilicato com tampa, resistente a temperaturas altas.',
        price: 59.9,
        category: 'Cozinha',
      },
    ],
  },
];
