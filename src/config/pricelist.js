/**
 * HYPERINDO GTA V Online Joki Service - Complete Price List
 * Berlaku untuk GTA V Online Legacy / Enhanced (harga sama)
 *
 * Source of truth untuk semua produk & paket.
 * Dipakai oleh seedPriceList.js dan /price command.
 */

const NON_PAKET = [
  // ── 1️⃣ SPECIAL / BONUS ──
  { name: "Ganti Gender", price: "Rp15.000", numericPrice: 15000, category: "1️⃣ Special / Bonus", sortOrder: 100 },
  { name: "Cayo + Casino Max Prep", price: "Rp20.000", numericPrice: 20000, category: "1️⃣ Special / Bonus", sortOrder: 101 },
  { name: "LSCM Prize Ride", price: "Rp20.000", numericPrice: 20000, category: "1️⃣ Special / Bonus", sortOrder: 102 },
  { name: "Casino Podium Car", price: "Rp20.000", numericPrice: 20000, category: "1️⃣ Special / Bonus", sortOrder: 103 },

  // ── 2️⃣ RECOVERY ──
  { name: "K/D Reset", price: "Rp10.000", numericPrice: 10000, category: "2️⃣ Recovery", sortOrder: 200 },
  { name: "Bad Sport Clean", price: "Rp15.000", numericPrice: 15000, category: "2️⃣ Recovery", sortOrder: 201 },
  { name: "Race Wins", price: "Rp10.000", numericPrice: 10000, category: "2️⃣ Recovery", sortOrder: 202 },
  { name: "Skill Unlock", price: "Rp10.000", numericPrice: 10000, category: "2️⃣ Recovery", sortOrder: 203 },

  // ── 3️⃣ KENDARAAN ──
  { name: "1 Kendaraan", price: "Rp5.000", numericPrice: 5000, category: "3️⃣ Kendaraan", sortOrder: 300 },
  { name: "5 Kendaraan", price: "Rp20.000", numericPrice: 20000, category: "3️⃣ Kendaraan", sortOrder: 301 },
  { name: "10 Kendaraan", price: "Rp35.000", numericPrice: 35000, category: "3️⃣ Kendaraan", sortOrder: 302 },
  { name: "15 Kendaraan", price: "Rp50.000", numericPrice: 50000, category: "3️⃣ Kendaraan", sortOrder: 303 },
  { name: "20 Kendaraan", price: "Rp65.000", numericPrice: 65000, category: "3️⃣ Kendaraan", sortOrder: 304 },

  // ── 4️⃣ MONEY HEIST ──
  { name: "1x Heist", price: "Rp2.500", numericPrice: 2500, description: "Estimasi ± $3.000.000 per heist", category: "4️⃣ Money Heist", sortOrder: 400 },
  { name: "5x Heist", price: "Rp12.500", numericPrice: 12500, description: "Estimasi ± $15.000.000", category: "4️⃣ Money Heist", sortOrder: 401 },
  { name: "10x Heist", price: "Rp25.000", numericPrice: 25000, description: "Estimasi ± $30.000.000", category: "4️⃣ Money Heist", sortOrder: 402 },
  { name: "20x Heist", price: "Rp50.000", numericPrice: 50000, description: "Estimasi ± $60.000.000", category: "4️⃣ Money Heist", sortOrder: 403 },
  { name: "50x Heist", price: "Rp120.000", numericPrice: 120000, description: "Estimasi ± $150.000.000", category: "4️⃣ Money Heist", sortOrder: 404 },
  { name: "100x Heist", price: "Rp240.000", numericPrice: 240000, description: "Estimasi ± $300.000.000", category: "4️⃣ Money Heist", sortOrder: 405 },

  // ── 5️⃣ RANK BOOST ──
  { name: "+100 Rank", price: "Rp20.000", numericPrice: 20000, category: "5️⃣ Rank Boost", sortOrder: 500 },
  { name: "+250 Rank", price: "Rp35.000", numericPrice: 35000, category: "5️⃣ Rank Boost", sortOrder: 501 },
  { name: "+500 Rank", price: "Rp60.000", numericPrice: 60000, category: "5️⃣ Rank Boost", sortOrder: 502 },
  { name: "+1000 Rank", price: "Rp100.000", numericPrice: 100000, category: "5️⃣ Rank Boost", sortOrder: 503 },
  { name: "+8000 Rank", price: "Rp200.000", numericPrice: 200000, category: "5️⃣ Rank Boost", sortOrder: 504 },
  { name: "+1000 LSCM Rep", price: "Rp25.000", numericPrice: 25000, category: "5️⃣ Rank Boost", sortOrder: 505 },
  { name: "Request Crew Rank", price: "Rp15.000", numericPrice: 15000, category: "5️⃣ Rank Boost", sortOrder: 506 },

  // ── 6️⃣ MAX STATS ──
  { name: "Stamina", price: "Rp8.000", numericPrice: 8000, category: "6️⃣ Max Stats", sortOrder: 600 },
  { name: "Strength", price: "Rp8.000", numericPrice: 8000, category: "6️⃣ Max Stats", sortOrder: 601 },
  { name: "Shooting", price: "Rp8.000", numericPrice: 8000, category: "6️⃣ Max Stats", sortOrder: 602 },
  { name: "Stealth", price: "Rp8.000", numericPrice: 8000, category: "6️⃣ Max Stats", sortOrder: 603 },
  { name: "Driving", price: "Rp8.000", numericPrice: 8000, category: "6️⃣ Max Stats", sortOrder: 604 },
  { name: "Flying", price: "Rp8.000", numericPrice: 8000, category: "6️⃣ Max Stats", sortOrder: 605 },
  { name: "Lung Capacity", price: "Rp8.000", numericPrice: 8000, category: "6️⃣ Max Stats", sortOrder: 606 },
  { name: "Full Max Stats", price: "Rp35.000", numericPrice: 35000, description: "Semua stats dimaksimalkan", category: "6️⃣ Max Stats", sortOrder: 607 },

  // ── 7️⃣ UNLOCK PACKAGE ──
  { name: "All DLC", price: "Rp25.000", numericPrice: 25000, category: "7️⃣ Unlock Package", sortOrder: 700 },
  { name: "Rare Weapons", price: "Rp15.000", numericPrice: 15000, category: "7️⃣ Unlock Package", sortOrder: 701 },
  { name: "Services", price: "Rp15.000", numericPrice: 15000, category: "7️⃣ Unlock Package", sortOrder: 702 },
  { name: "Fast Run", price: "Rp15.000", numericPrice: 15000, category: "7️⃣ Unlock Package", sortOrder: 703 },
  { name: "Arena War", price: "Rp15.000", numericPrice: 15000, category: "7️⃣ Unlock Package", sortOrder: 704 },
  { name: "All Trophies", price: "Rp15.000", numericPrice: 15000, category: "7️⃣ Unlock Package", sortOrder: 705 },
  { name: "All Weapons", price: "Rp15.000", numericPrice: 15000, category: "7️⃣ Unlock Package", sortOrder: 706 },
  { name: "All Ammo", price: "Rp10.000", numericPrice: 10000, category: "7️⃣ Unlock Package", sortOrder: 707 },
  { name: "All Outfits", price: "Rp15.000", numericPrice: 15000, category: "7️⃣ Unlock Package", sortOrder: 708 },
  { name: "All Liveries", price: "Rp15.000", numericPrice: 15000, category: "7️⃣ Unlock Package", sortOrder: 709 },
  { name: "All Tattoos", price: "Rp10.000", numericPrice: 10000, category: "7️⃣ Unlock Package", sortOrder: 710 },
  { name: "All Hairstyles", price: "Rp10.000", numericPrice: 10000, category: "7️⃣ Unlock Package", sortOrder: 711 },
  { name: "All Masks", price: "Rp10.000", numericPrice: 10000, category: "7️⃣ Unlock Package", sortOrder: 712 },
  { name: "All Accessories", price: "Rp10.000", numericPrice: 10000, category: "7️⃣ Unlock Package", sortOrder: 713 },
  { name: "1 Modded Outfit", price: "Rp20.000", numericPrice: 20000, category: "7️⃣ Unlock Package", sortOrder: 714 },

  // ── 8️⃣ PROPERTY / BISNIS ──
  { name: "CEO Office", price: "Rp10.000", numericPrice: 10000, category: "8️⃣ Property / Bisnis", sortOrder: 800 },
  { name: "Kosatka", price: "Rp10.000", numericPrice: 10000, category: "8️⃣ Property / Bisnis", sortOrder: 801 },
  { name: "Agency", price: "Rp10.000", numericPrice: 10000, category: "8️⃣ Property / Bisnis", sortOrder: 802 },
  { name: "Arcade", price: "Rp10.000", numericPrice: 10000, category: "8️⃣ Property / Bisnis", sortOrder: 803 },
  { name: "Nightclub", price: "Rp10.000", numericPrice: 10000, category: "8️⃣ Property / Bisnis", sortOrder: 804 },
  { name: "Bunker", price: "Rp10.000", numericPrice: 10000, category: "8️⃣ Property / Bisnis", sortOrder: 805 },
  { name: "Facility", price: "Rp10.000", numericPrice: 10000, category: "8️⃣ Property / Bisnis", sortOrder: 806 },
  { name: "Auto Shop", price: "Rp10.000", numericPrice: 10000, category: "8️⃣ Property / Bisnis", sortOrder: 807 },
  { name: "MC Clubhouse", price: "Rp8.000", numericPrice: 8000, category: "8️⃣ Property / Bisnis", sortOrder: 808 },
  { name: "Hangar", price: "Rp10.000", numericPrice: 10000, category: "8️⃣ Property / Bisnis", sortOrder: 809 },
  { name: "Penthouse", price: "Rp10.000", numericPrice: 10000, category: "8️⃣ Property / Bisnis", sortOrder: 810 },
  { name: "Yacht", price: "Rp10.000", numericPrice: 10000, category: "8️⃣ Property / Bisnis", sortOrder: 811 },
  { name: "Terrorbyte", price: "Rp15.000", numericPrice: 15000, category: "8️⃣ Property / Bisnis", sortOrder: 812 },
  { name: "Avenger", price: "Rp15.000", numericPrice: 15000, category: "8️⃣ Property / Bisnis", sortOrder: 813 },
  { name: "1 Mansion", price: "Rp10.000", numericPrice: 10000, category: "8️⃣ Property / Bisnis", sortOrder: 814 },
  { name: "3 Mansion", price: "Rp20.000", numericPrice: 20000, category: "8️⃣ Property / Bisnis", sortOrder: 815 },
  { name: "5 High-End Apartment", price: "Rp15.000", numericPrice: 15000, category: "8️⃣ Property / Bisnis", sortOrder: 816 },
  { name: "8 High-End Apartment", price: "Rp20.000", numericPrice: 20000, category: "8️⃣ Property / Bisnis", sortOrder: 817 },
  { name: "10 High-End Apartment", price: "Rp25.000", numericPrice: 25000, category: "8️⃣ Property / Bisnis", sortOrder: 818 },
];

const PAKET = [
  {
    name: "Paket Saudagar",
    price: "Rp89.000",
    numericPrice: 89000,
    category: "📦 Paket Bundling",
    sortOrder: 900,
    description: [
      "Estimasi Money Heist: ± $30JT - $34JT (setara 10x Heist)",
      "+100 Rank",
      "Full Max Stats",
      "3 Kendaraan",
    ].join("\n"),
  },
  {
    name: "Paket Juragan",
    price: "Rp149.000",
    numericPrice: 149000,
    category: "📦 Paket Bundling",
    sortOrder: 901,
    description: [
      "Estimasi Money Heist: ± $60JT - $68JT (setara 20x Heist)",
      "+250 Rank",
      "Full Max Stats",
      "+1000 LSCM Rep",
      "Fast Run Ability",
      "5 Kendaraan",
    ].join("\n"),
  },
  {
    name: "Paket Ningrat",
    price: "Rp299.000",
    numericPrice: 299000,
    category: "📦 Paket Bundling",
    sortOrder: 902,
    description: [
      "Estimasi Money Heist: ± $150JT - $170JT (setara 50x Heist)",
      "+500 Rank",
      "Full Max Stats",
      "+1000 LSCM Rep",
      "Fast Run Ability",
      "Unlock All DLC",
      "Unlock Rare Weapons",
      "10 Kendaraan",
      "3 Modded Outfit",
    ].join("\n"),
  },
  {
    name: "Paket Raja",
    price: "Rp449.000",
    numericPrice: 449000,
    category: "📦 Paket Bundling",
    sortOrder: 903,
    description: [
      "Estimasi Money Heist: ± $240JT - $272JT (setara 80x Heist)",
      "+1000 Rank",
      "Full Max Stats",
      "+1000 LSCM Rep",
      "Fast Run Ability",
      "Unlock All DLC",
      "Unlock Rare Weapons",
      "Unlock Arena War",
      "Unlock All Trophies",
      "15 Kendaraan",
      "5 Modded Outfit",
    ].join("\n"),
  },
  {
    name: "Paket Sultan",
    price: "Rp649.000",
    numericPrice: 649000,
    category: "📦 Paket Bundling",
    sortOrder: 904,
    description: [
      "Estimasi Money Heist: ± $300JT - $340JT (setara 100x Heist)",
      "+8000 / Request Rank",
      "Full Max Stats",
      "+1000 LSCM Rep",
      "Fast Run Ability",
      "Unlock All DLC",
      "Unlock Rare Weapons",
      "Unlock Arena War",
      "Unlock All Trophies",
      "Unlock Bisnis",
      "Unlock Services",
      "20 Kendaraan",
      "10 Modded Outfit",
    ].join("\n"),
  },
];

const MIGRASI = [
  {
    name: "Migrasi Legacy ⇄ Enhanced",
    price: "Rp10.000",
    numericPrice: 10000,
    category: "🔄 Migrasi",
    sortOrder: 950,
    description: [
      "Per akun, saat proses joki sedang berjalan",
      "Berlaku jika order sudah mulai dikerjakan",
      "Migrasi hanya bisa dilakukan 1x per order",
    ].join("\n"),
  },
];

const KETENTUAN = [
  "Berlaku untuk GTA V Online Legacy / Enhanced",
  "Harga Legacy dan Enhanced sama",
  "Money didapat dari hasil run heist, bukan drop money",
  "Estimasi hasil bisa berbeda tiap run",
  "Proses menyesuaikan cooldown akun",
  "Order diproses sesuai antrian dan jam operasional penjoki",
  "Proses tidak bisa dipaksa cepat",
  "Wajib info dari awal akun Legacy atau Enhanced",
  "Wajib memberikan data akun / data order dengan benar",
  "Kesalahan data dari buyer bukan tanggung jawab penjoki",
  "Request di luar pricelist akan dikenakan biaya tambahan",
  "Request khusus menyesuaikan ketersediaan admin / penjoki",
  "Order yang sudah masuk tidak bisa dibatalkan di tengah proses",
  "No refund jika proses sudah dimulai",
  "Wajib memberikan testimoni setelah order selesai",
  "Jika tidak memberikan testimoni, safe guard / anti ban tidak berlaku",
  "Harga dan layanan dapat berubah sewaktu-waktu jika ada update / perubahan dari Rockstar",
  "Dengan melakukan order, buyer dianggap sudah memahami dan menyetujui semua ketentuan yang berlaku",
];

/**
 * Returns the full flat list of all products (non-paket + paket + migrasi).
 */
function getAllProducts() {
  return [...NON_PAKET, ...PAKET, ...MIGRASI];
}

/**
 * Returns products grouped by category (preserving sort order).
 */
function getGroupedProducts() {
  const all = getAllProducts();
  const groups = new Map();
  for (const item of all) {
    const cat = item.category || "Lainnya";
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat).push(item);
  }
  // Sort within each group
  for (const [, items] of groups) {
    items.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }
  return groups;
}

module.exports = {
  NON_PAKET,
  PAKET,
  MIGRASI,
  KETENTUAN,
  getAllProducts,
  getGroupedProducts,
};
