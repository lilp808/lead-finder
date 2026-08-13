// Agent team assignment — deterministic rule-based, never guesses.
// Lookup with Thai aliases (Facebook posts).
// Unknown/missing location returns null (needs human review).

export const TEAM_LABELS = {
  A: 'Team A',
  B: 'Team B',
  C: 'Team C',
};

// Province → team. English primary, Thai alias.
const PROVINCE_TEAM = {
  // A
  'samut prakan': 'A', 'สมุทรปราการ': 'A',
  'chachoengsao': 'A', 'ฉะเชิงเทรา': 'A',
  'samut sakhon': 'A', 'สมุทรสาคร': 'A',
  // B
  'chonburi': 'B', 'ชลบุรี': 'B',
  'rayong': 'B', 'ระยอง': 'B',
  // C
  'ayutthaya': 'C', 'phra nakhon si ayutthaya': 'C', 'พระนครศรีอยุธยา': 'C', 'อยุธยา': 'C',
  'pathum thani': 'C', 'ปทุมธานี': 'C',
  'nonthaburi': 'C', 'นนทบุรี': 'C',
  'nakhon pathom': 'C', 'นครปฐม': 'C',
};

// Bangkok provinces (Thai + English variants) → check district list first
const BANGKOK_ALIASES = new Set([
  'bangkok', 'krung thep', 'krungthep', 'bangkok metropolis',
  'กรุงเทพมหานคร', 'กรุงเทพ', 'กทม',
]);

// Bangkok districts that belong to Team A
const BANGKOK_A_DISTRICTS = new Set([
  'bang khun thian', 'บางขุนเทียน',
  'bang na', 'บางนา',
  'lat krabang', 'ลาดกระบัง',
  'lam phak chi', 'ลำผักชี',
  'phra khanong', 'พระโขนง',
  'prawet', 'ประเวศ',
  'saphan sung', 'สะพานสูง',
  'suan luang', 'สวนหลวง',
]);

// Bangkok districts that belong to Team C
const BANGKOK_C_DISTRICTS = new Set([
  'bang kapi', 'บางกะปิ',
  'bang khen', 'บางเขน',
  'bueng kum', 'บึงกุ่ม',
  'chatuchak', 'จตุจักร',
  'don mueang', 'ดอนเมือง',
  'khan na yao', 'คันนายาว',
  'khlong sam wa', 'คลองสามวา',
  'lak si', 'หลักสี่',
  'lat phrao', 'ลาดพร้าว',
  'min buri', 'มีนบุรี',
  'sai mai', 'สายไหม',
  'wang thonglang', 'วังทองหลาง',
]);

// The 77 real Thai provinces (English primary) — used to reject garbage
// location values so an unknown province never produces a wrong team.
const THAI_PROVINCES = new Set([
  'bangkok', 'samut prakan', 'nonthaburi', 'pathum thani', 'ayutthaya',
  'ang thong', 'lopburi', 'sing buri', 'chai nat', 'saraburi',
  'chonburi', 'rayong', 'chachoengsao', 'prachinburi', 'sa kaeo',
  'nakhon nayok', 'chanthaburi', 'trat',
  'nakhon ratchasima', 'buriram', 'surin', 'sisaket', 'ubon ratchathani',
  'yasothon', 'chaiyaphum', 'amnat charoen', 'bueng kan', 'nong bua lamphu',
  'khon kaen', 'udon thani', 'loei', 'nong khai', 'mukdahan', 'sakon nakhon',
  'nakhon phanom', 'kalasin', 'maha sarakham', 'roi et',
  'chiang mai', 'lamphun', 'lamphang', 'utraradit', 'phrae', 'nan',
  'phayao', 'chiang rai', 'mae hong son',
  'nakhon sawan', 'u thai thani', 'kamphaeng phet', 'tak', 'sukhothai',
  'phitsanulok', 'phichit', 'phetchabun',
  'racha buri', 'kanchanaburi', 'suphanburi', 'samut songkhram',
  'phetchaburi', 'prachuap khiri khan',
  'nakhon si thammarat', 'krabi', 'phangnga', 'phuket', 'surat thani',
  'ranong', 'chumphon', 'songkhla', 'satun', 'trang', 'phatthalung',
  'pattani', 'yala', 'narathiwat',
]);

export function normalize(value) {
  if (!value) return '';
  return String(value).trim().toLowerCase().replace(/\s+/g, ' ').replace(/\./g, '');
}

export function isBangkok(province) {
  return BANGKOK_ALIASES.has(normalize(province));
}

export function isValidProvince(province) {
  return THAI_PROVINCES.has(normalize(province));
}

export function assignAgentTeam({ province, district, sub_district } = {}) {
  const prov = normalize(province);
  const dist = normalize(district) || normalize(sub_district);

  if (isBangkok(prov)) {
    if (BANGKOK_A_DISTRICTS.has(dist)) return 'A';
    if (BANGKOK_C_DISTRICTS.has(dist)) return 'C';
    return null;
  }

  const team = PROVINCE_TEAM[prov];
  if (team) return team;

  return null;
}
