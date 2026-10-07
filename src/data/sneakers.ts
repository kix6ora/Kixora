import { Sneaker, Drop, PromoCode, Order } from '../types';

const sneakerModelBaseUrl = import.meta.env.VITE_SNEAKER_MODEL_BASE_URL?.replace(/\/$/, '');
const sneakerModelUrl = (filename: string) => sneakerModelBaseUrl ? `${sneakerModelBaseUrl}/${filename}.glb` : undefined;

export const INITIAL_SNEAKERS: Sneaker[] = [
  {
    id: 'kixo-shattered-backboard-01',
    name: 'Air Jordan 1 Retro High OG "Shattered Backboard"',
    brand: 'Jordan',
    category: 'High-Top',
    gender: 'Men',
    price: 4999,
    originalPrice: 5499,
    description: 'Inspired by the uniform Michael Jordan wore when he shattered the glass backboard in an Italian exhibition game.',
    image: 'https://res.cloudinary.com/kixora/image/upload/f_auto,q_auto/kixora/products/shattered-backboard-01.png',
    modelUrl: sneakerModelUrl('kixo-shattered-backboard-01'),
    images: [
      'https://res.cloudinary.com/kixora/image/upload/f_auto,q_auto/kixora/products/shattered-backboard-01.png',
      'https://res.cloudinary.com/kixora/image/upload/f_auto,q_auto/kixora/products/shattered-backboard-02.png'
    ],
    gallery: [
      'https://res.cloudinary.com/kixora/image/upload/f_auto,q_auto/kixora/products/shattered-backboard-01.png',
      'https://res.cloudinary.com/kixora/image/upload/f_auto,q_auto/kixora/products/shattered-backboard-02.png'
    ],
    sizes: [
      { size: 8, stock: 3 },
      { size: 8.5, stock: 4 },
      { size: 9, stock: 6 },
      { size: 9.5, stock: 5 },
      { size: 10, stock: 4 },
      { size: 10.5, stock: 2 },
      { size: 11, stock: 3 }
    ],
    colorway: 'Starfish/Black-Sail',
    releaseYear: 2015,
    sku: '555088-005',
    story: 'One of the most sought-after non-OG colorways in Jordan brand history, crafted with premium tumbled leather.',
    details: ['Premium tumbled leather', 'Perforated toe box', 'Encapsulated Air-Sole unit'],
    tags: ['Vault Grail', 'Deadstock', 'High Hype'],
    rating: 4.9,
    reviewsCount: 128,
    salesCount: 342,
    isVaultExclusive: true,
    featured: true,
    isFeatured: true,
    isNewRelease: false,
    isBestSeller: true
  },
  {
    id: 'kixo-travis-scott-reverse-02',
    name: 'Travis Scott x Air Jordan 1 Low OG "Reverse Mocha"',
    brand: 'Jordan',
    category: 'Low-Top',
    gender: 'Men',
    price: 5899,
    originalPrice: 6200,
    description: 'Featuring the iconic inverted oversized Swoosh and signature Cactus Jack heel embroidery.',
    image: 'https://res.cloudinary.com/kixora/image/upload/f_auto,q_auto/kixora/products/travis-scott-mocha-01.png',
    modelUrl: sneakerModelUrl('kixo-travis-scott-reverse-02'),
    images: [
      'https://res.cloudinary.com/kixora/image/upload/f_auto,q_auto/kixora/products/travis-scott-mocha-01.png'
    ],
    gallery: [
      'https://res.cloudinary.com/kixora/image/upload/f_auto,q_auto/kixora/products/travis-scott-mocha-01.png'
    ],
    sizes: [
      { size: 8.5, stock: 2 },
      { size: 9, stock: 3 },
      { size: 9.5, stock: 4 },
      { size: 10, stock: 5 },
      { size: 11, stock: 2 }
    ],
    colorway: 'Sail/University Red-Ridgerock',
    releaseYear: 2022,
    sku: 'DM7866-162',
    story: 'A continuation of the acclaimed Houston rapper collaboration series with Earth-toned nubuck overlays.',
    details: ['Reverse oversized Swoosh', 'Cactus Jack logo embroidery', 'Vintage Sail midsole'],
    tags: ['Vault Grail', 'Collab', 'Ultra Rare'],
    rating: 5.0,
    reviewsCount: 95,
    salesCount: 410,
    isVaultExclusive: true,
    featured: true,
    isFeatured: true,
    isNewRelease: true,
    isBestSeller: true
  },
  {
    id: 'kixo-dunk-low-panda-03',
    name: 'Nike Dunk Low Retro "Panda"',
    brand: 'Nike',
    category: 'Low-Top',
    gender: 'Unisex',
    price: 2499,
    originalPrice: 2899,
    description: 'The ultra-clean monochrome icon that defined modern street culture.',
    image: 'https://res.cloudinary.com/kixora/image/upload/f_auto,q_auto/kixora/products/dunk-low-panda-01.png',
    modelUrl: sneakerModelUrl('kixo-dunk-low-panda-03'),
    images: [
      'https://res.cloudinary.com/kixora/image/upload/f_auto,q_auto/kixora/products/dunk-low-panda-01.png'
    ],
    gallery: [
      'https://res.cloudinary.com/kixora/image/upload/f_auto,q_auto/kixora/products/dunk-low-panda-01.png'
    ],
    sizes: [
      { size: 7, stock: 5 },
      { size: 8, stock: 8 },
      { size: 9, stock: 10 },
      { size: 10, stock: 12 },
      { size: 11, stock: 4 }
    ],
    colorway: 'White/Black',
    releaseYear: 2021,
    sku: 'DD1391-100',
    story: 'Classic basketball silhouette turned everyday style essential.',
    details: ['Two-tone leather upper', 'Padded low-cut collar', 'Foam insole'],
    tags: ['Street Essential', 'Best Seller'],
    rating: 4.7,
    reviewsCount: 312,
    salesCount: 1250,
    featured: true,
    isFeatured: true,
    isNewRelease: false,
    isBestSeller: true
  },
  {
    id: 'kixo-af1-triple-white-07',
    name: "Nike Air Force 1 '07 \"Triple White\"",
    brand: 'Nike',
    category: 'Low-Top',
    gender: 'Unisex',
    price: 1999,
    originalPrice: 2299,
    description: 'The radiance lives on with the b-ball icon that puts a fresh spin on crisp leather and clean lines.',
    image: 'https://res.cloudinary.com/kixora/image/upload/f_auto,q_auto/kixora/products/af1-triple-white-01.png',
    modelUrl: sneakerModelUrl('kixo-af1-triple-white-07'),
    images: [
      'https://res.cloudinary.com/kixora/image/upload/f_auto,q_auto/kixora/products/af1-triple-white-01.png'
    ],
    gallery: [
      'https://res.cloudinary.com/kixora/image/upload/f_auto,q_auto/kixora/products/af1-triple-white-01.png'
    ],
    sizes: [
      { size: 8, stock: 10 },
      { size: 9, stock: 15 },
      { size: 9.5, stock: 12 },
      { size: 10, stock: 14 },
      { size: 11, stock: 8 }
    ],
    colorway: 'White/White',
    releaseYear: 2022,
    sku: 'CW2288-111',
    story: 'Legendary court heritage with unmistakable pristine white tumbled leather.',
    details: ['Stitched leather overlays', 'Nike Air cushioning', 'Padded low-cut collar'],
    tags: ['Essential', 'All White', 'Streetwear'],
    rating: 4.8,
    reviewsCount: 520,
    salesCount: 2100,
    featured: true,
    isFeatured: true,
    isNewRelease: false,
    isBestSeller: true
  },
  {
    id: 'kixo-aj4-black-cat-04',
    name: 'Air Jordan 4 Retro "Black Cat"',
    brand: 'Jordan',
    category: 'Mid-Top',
    gender: 'Men',
    price: 5299,
    description: 'Triple-black nubuck stealth icon named after Michael Jordan’s nickname.',
    image: 'https://res.cloudinary.com/kixora/image/upload/f_auto,q_auto/kixora/products/aj4-black-cat-01.png',
    modelUrl: sneakerModelUrl('kixo-aj4-black-cat-04'),
    images: [
      'https://res.cloudinary.com/kixora/image/upload/f_auto,q_auto/kixora/products/aj4-black-cat-01.png'
    ],
    gallery: [
      'https://res.cloudinary.com/kixora/image/upload/f_auto,q_auto/kixora/products/aj4-black-cat-01.png'
    ],
    sizes: [
      { size: 9, stock: 2 },
      { size: 9.5, stock: 4 },
      { size: 10, stock: 3 },
      { size: 10.5, stock: 1 }
    ],
    colorway: 'Black/Black-Light Graphite',
    releaseYear: 2020,
    sku: 'CU1110-010',
    story: 'One of the most stealthy and premium Retro 4 executions ever produced.',
    details: ['All-black nubuck upper', 'Matte black eyelets', 'Visible Air unit'],
    tags: ['Vault Grail', 'Triple Black'],
    rating: 4.9,
    reviewsCount: 88,
    salesCount: 290,
    isVaultExclusive: true,
    featured: true,
    isFeatured: true,
    isNewRelease: false,
    isBestSeller: true
  },
  {
    id: 'kixo-yeezy-boost-350-05',
    name: 'adidas Yeezy Boost 350 V2 "Zebra"',
    brand: 'Yeezy',
    category: 'Low-Top',
    gender: 'Unisex',
    price: 3899,
    description: 'Iconic Primeknit zebra-striped upper with SPLY-350 branding in solar red.',
    image: 'https://res.cloudinary.com/kixora/image/upload/f_auto,q_auto/kixora/products/yeezy-zebra-01.png',
    modelUrl: sneakerModelUrl('kixo-yeezy-boost-350-05'),
    images: [
      'https://res.cloudinary.com/kixora/image/upload/f_auto,q_auto/kixora/products/yeezy-zebra-01.png'
    ],
    gallery: [
      'https://res.cloudinary.com/kixora/image/upload/f_auto,q_auto/kixora/products/yeezy-zebra-01.png'
    ],
    sizes: [
      { size: 8, stock: 4 },
      { size: 9, stock: 6 },
      { size: 10, stock: 7 },
      { size: 11, stock: 3 }
    ],
    colorway: 'White/Core Black/Red',
    releaseYear: 2017,
    sku: 'CP9654',
    story: 'A holy grail of the Yeezy boost era that ushered in knit runner dominance.',
    details: ['Primeknit upper', 'Full-length Boost midsole', 'SPLY-350 reverse lettering'],
    tags: ['Primeknit', 'Boost'],
    rating: 4.8,
    reviewsCount: 210,
    salesCount: 890,
    featured: false,
    isFeatured: false,
    isNewRelease: false,
    isBestSeller: false
  },
  {
    id: 'kixo-nb-990v6-06',
    name: 'New Balance 990v6 "Grey"',
    brand: 'New Balance',
    category: 'Low-Top',
    gender: 'Unisex',
    price: 3699,
    description: 'Made in USA craftsmanship equipped with FuelCell foam cushioning.',
    image: 'https://res.cloudinary.com/kixora/image/upload/f_auto,q_auto/kixora/products/nb-990v6-grey-01.png',
    images: [
      'https://res.cloudinary.com/kixora/image/upload/f_auto,q_auto/kixora/products/nb-990v6-grey-01.png'
    ],
    gallery: [
      'https://res.cloudinary.com/kixora/image/upload/f_auto,q_auto/kixora/products/nb-990v6-grey-01.png'
    ],
    sizes: [
      { size: 8, stock: 5 },
      { size: 9, stock: 8 },
      { size: 10, stock: 6 },
      { size: 11, stock: 4 }
    ],
    colorway: 'Grey/Castlerock',
    releaseYear: 2022,
    sku: 'M990GL6',
    story: 'The flagship heritage running shoe designed without compromise.',
    details: ['FuelCell midsole foam', 'Suede and mesh upper', 'Made in USA'],
    tags: ['Made in USA', 'Heritage'],
    rating: 4.9,
    reviewsCount: 142,
    salesCount: 420,
    featured: false,
    isFeatured: false,
    isNewRelease: false,
    isBestSeller: false
  }
];

export const INITIAL_DROPS: Drop[] = [
  {
    id: 'drop-01',
    sneakerName: 'Off-White x Nike Air Force 1 "MCA"',
    brand: 'Nike',
    price: 6500,
    releaseTime: '2026-09-15T18:00:00Z',
    image: 'https://res.cloudinary.com/kixora/image/upload/f_auto,q_auto/kixora/drops/offwhite-mca-drop.png',
    description: 'Museum of Contemporary Art Chicago exclusive in University Blue.',
    isNotified: false,
    subscribersCount: 1420,
    raffleOpen: true,
    editionSize: 50
  },
  {
    id: 'drop-02',
    sneakerName: 'Tiffany & Co. x Nike Air Force 1 Low "1837"',
    brand: 'Nike',
    price: 7200,
    releaseTime: '2026-09-28T16:00:00Z',
    image: 'https://res.cloudinary.com/kixora/image/upload/f_auto,q_auto/kixora/drops/tiffany-af1-drop.png',
    description: 'Premium black suede with Tiffany Blue tumbled leather swoosh and 925 sterling silver heel tag.',
    isNotified: true,
    subscribersCount: 2840,
    raffleOpen: true,
    editionSize: 75
  }
];

export const INITIAL_PROMOS: PromoCode[] = [
  {
    id: 'promo-00',
    code: 'KIX10',
    discountPercent: 10,
    minSpend: 0,
    isActive: true
  },
  {
    id: 'promo-01',
    code: 'VAULT10',
    discountPercent: 10,
    minSpend: 3000,
    isActive: true
  },
  {
    id: 'promo-02',
    code: 'KIXORA15',
    discountPercent: 15,
    minSpend: 5000,
    isActive: true
  }
];

export const INITIAL_ORDERS: Order[] = [
  {
    id: 'KXO-7821',
    trackingNumber: 'KX-89214732-ZA',
    createdAt: '2026-08-20T14:32:00Z',
    customer: {
      fullName: 'Marcus Vance',
      email: 'm.vance@example.com',
      phone: '+27 82 555 1923',
      street: '14 Kloof Street',
      city: 'Cape Town',
      state: 'Western Cape',
      zip: '8001',
      country: 'South Africa'
    },
    items: [
      {
        id: 'item-demo-01',
        sneaker: INITIAL_SNEAKERS[0],
        selectedSize: 10,
        quantity: 1
      }
    ],
    subtotal: 4999,
    discount: 0,
    shippingFee: 0,
    tax: 0,
    total: 4999,
    status: 'Processing',
    paymentMethod: 'Instant EFT / Ozow',
    shippingMethod: 'Vault Express Courier',
    timeline: [
      {
        title: 'Order Confirmed & in Vault Authentication',
        timestamp: 'Aug 20, 14:32',
        description: 'Payment authorized. Order sent to 12-point authentication facility.',
        completed: true
      },
      {
        title: '12-Point Authentication Inspection',
        timestamp: 'Pending (In Queue)',
        description: 'Senior authenticator will verify stitching, box label, and affix NFC Security Tag.',
        completed: false
      },
      {
        title: 'Vault Double-Box Packing',
        timestamp: 'Pending',
        description: 'Secured inside reinforced double-wall packaging.',
        completed: false
      },
      {
        title: 'Dispatched with Courier',
        timestamp: 'Pending',
        description: 'Express collection scheduled.',
        completed: false
      }
    ]
  }
];
