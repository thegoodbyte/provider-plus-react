export interface Country {
  code: string;
  name: string;
  phonePrefix: string;
  flag: string;
}

export const COUNTRIES: Country[] = [
  // Prioritize common countries first (Czech Republic, Poland, USA, Germany, etc.)
  { code: 'CZ', name: 'Czech Republic', phonePrefix: '+420', flag: '🇨🇿' },
  { code: 'PL', name: 'Poland', phonePrefix: '+48', flag: '🇵🇱' },
  { code: 'US', name: 'United States', phonePrefix: '+1', flag: '🇺🇸' },
  { code: 'DE', name: 'Germany', phonePrefix: '+49', flag: '🇩🇪' },
  { code: 'GB', name: 'United Kingdom', phonePrefix: '+44', flag: '🇬🇧' },
  { code: 'FR', name: 'France', phonePrefix: '+33', flag: '🇫🇷' },
  { code: 'IT', name: 'Italy', phonePrefix: '+39', flag: '🇮🇹' },
  { code: 'ES', name: 'Spain', phonePrefix: '+34', flag: '🇪🇸' },
  { code: 'NL', name: 'Netherlands', phonePrefix: '+31', flag: '🇳🇱' },
  { code: 'AT', name: 'Austria', phonePrefix: '+43', flag: '🇦🇹' },

  // Additional European countries
  { code: 'SK', name: 'Slovakia', phonePrefix: '+421', flag: '🇸🇰' },
  { code: 'HU', name: 'Hungary', phonePrefix: '+36', flag: '🇭🇺' },
  { code: 'RO', name: 'Romania', phonePrefix: '+40', flag: '🇷🇴' },
  { code: 'BG', name: 'Bulgaria', phonePrefix: '+359', flag: '🇧🇬' },
  { code: 'HR', name: 'Croatia', phonePrefix: '+385', flag: '🇭🇷' },
  { code: 'SI', name: 'Slovenia', phonePrefix: '+386', flag: '🇸🇮' },
  { code: 'RS', name: 'Serbia', phonePrefix: '+381', flag: '🇷🇸' },
  { code: 'BA', name: 'Bosnia and Herzegovina', phonePrefix: '+387', flag: '🇧🇦' },
  { code: 'ME', name: 'Montenegro', phonePrefix: '+382', flag: '🇲🇪' },
  { code: 'MK', name: 'North Macedonia', phonePrefix: '+389', flag: '🇲🇰' },
  { code: 'AL', name: 'Albania', phonePrefix: '+355', flag: '🇦🇱' },
  { code: 'GR', name: 'Greece', phonePrefix: '+30', flag: '🇬🇷' },
  { code: 'PT', name: 'Portugal', phonePrefix: '+351', flag: '🇵🇹' },
  { code: 'BE', name: 'Belgium', phonePrefix: '+32', flag: '🇧🇪' },
  { code: 'LU', name: 'Luxembourg', phonePrefix: '+352', flag: '🇱🇺' },
  { code: 'CH', name: 'Switzerland', phonePrefix: '+41', flag: '🇨🇭' },
  { code: 'LI', name: 'Liechtenstein', phonePrefix: '+423', flag: '🇱🇮' },
  { code: 'SE', name: 'Sweden', phonePrefix: '+46', flag: '🇸🇪' },
  { code: 'NO', name: 'Norway', phonePrefix: '+47', flag: '🇳🇴' },
  { code: 'DK', name: 'Denmark', phonePrefix: '+45', flag: '🇩🇰' },
  { code: 'FI', name: 'Finland', phonePrefix: '+358', flag: '🇫🇮' },
  { code: 'IS', name: 'Iceland', phonePrefix: '+354', flag: '🇮🇸' },
  { code: 'IE', name: 'Ireland', phonePrefix: '+353', flag: '🇮🇪' },
  { code: 'MT', name: 'Malta', phonePrefix: '+356', flag: '🇲🇹' },
  { code: 'CY', name: 'Cyprus', phonePrefix: '+357', flag: '🇨🇾' },
  { code: 'EE', name: 'Estonia', phonePrefix: '+372', flag: '🇪🇪' },
  { code: 'LV', name: 'Latvia', phonePrefix: '+371', flag: '🇱🇻' },
  { code: 'LT', name: 'Lithuania', phonePrefix: '+370', flag: '🇱🇹' },

  // Other major countries
  { code: 'CA', name: 'Canada', phonePrefix: '+1', flag: '🇨🇦' },
  { code: 'AU', name: 'Australia', phonePrefix: '+61', flag: '🇦🇺' },
  { code: 'NZ', name: 'New Zealand', phonePrefix: '+64', flag: '🇳🇿' },
  { code: 'JP', name: 'Japan', phonePrefix: '+81', flag: '🇯🇵' },
  { code: 'KR', name: 'South Korea', phonePrefix: '+82', flag: '🇰🇷' },
  { code: 'CN', name: 'China', phonePrefix: '+86', flag: '🇨🇳' },
  { code: 'IN', name: 'India', phonePrefix: '+91', flag: '🇮🇳' },
  { code: 'BR', name: 'Brazil', phonePrefix: '+55', flag: '🇧🇷' },
  { code: 'MX', name: 'Mexico', phonePrefix: '+52', flag: '🇲🇽' },
  { code: 'AR', name: 'Argentina', phonePrefix: '+54', flag: '🇦🇷' },
  { code: 'CL', name: 'Chile', phonePrefix: '+56', flag: '🇨🇱' },
  { code: 'CO', name: 'Colombia', phonePrefix: '+57', flag: '🇨🇴' },
  { code: 'PE', name: 'Peru', phonePrefix: '+51', flag: '🇵🇪' },
  { code: 'VE', name: 'Venezuela', phonePrefix: '+58', flag: '🇻🇪' },
  { code: 'UY', name: 'Uruguay', phonePrefix: '+598', flag: '🇺🇾' },
  { code: 'PY', name: 'Paraguay', phonePrefix: '+595', flag: '🇵🇾' },
  { code: 'BO', name: 'Bolivia', phonePrefix: '+591', flag: '🇧🇴' },
  { code: 'EC', name: 'Ecuador', phonePrefix: '+593', flag: '🇪🇨' },

  // Middle East and Africa
  { code: 'IL', name: 'Israel', phonePrefix: '+972', flag: '🇮🇱' },
  { code: 'TR', name: 'Turkey', phonePrefix: '+90', flag: '🇹🇷' },
  { code: 'EG', name: 'Egypt', phonePrefix: '+20', flag: '🇪🇬' },
  { code: 'ZA', name: 'South Africa', phonePrefix: '+27', flag: '🇿🇦' },
  { code: 'MA', name: 'Morocco', phonePrefix: '+212', flag: '🇲🇦' },
  { code: 'TN', name: 'Tunisia', phonePrefix: '+216', flag: '🇹🇳' },
  { code: 'DZ', name: 'Algeria', phonePrefix: '+213', flag: '🇩🇿' },
  { code: 'LY', name: 'Libya', phonePrefix: '+218', flag: '🇱🇾' },

  // Eastern Europe and Former Soviet Union
  { code: 'RU', name: 'Russia', phonePrefix: '+7', flag: '🇷🇺' },
  { code: 'UA', name: 'Ukraine', phonePrefix: '+380', flag: '🇺🇦' },
  { code: 'BY', name: 'Belarus', phonePrefix: '+375', flag: '🇧🇾' },
  { code: 'MD', name: 'Moldova', phonePrefix: '+373', flag: '🇲🇩' },
  { code: 'GE', name: 'Georgia', phonePrefix: '+995', flag: '🇬🇪' },
  { code: 'AM', name: 'Armenia', phonePrefix: '+374', flag: '🇦🇲' },
  { code: 'AZ', name: 'Azerbaijan', phonePrefix: '+994', flag: '🇦🇿' },
  { code: 'KZ', name: 'Kazakhstan', phonePrefix: '+7', flag: '🇰🇿' },
  { code: 'UZ', name: 'Uzbekistan', phonePrefix: '+998', flag: '🇺🇿' },
  { code: 'TM', name: 'Turkmenistan', phonePrefix: '+993', flag: '🇹🇲' },
  { code: 'TJ', name: 'Tajikistan', phonePrefix: '+992', flag: '🇹🇯' },
  { code: 'KG', name: 'Kyrgyzstan', phonePrefix: '+996', flag: '🇰🇬' },

  // Additional countries
  { code: 'TH', name: 'Thailand', phonePrefix: '+66', flag: '🇹🇭' },
  { code: 'VN', name: 'Vietnam', phonePrefix: '+84', flag: '🇻🇳' },
  { code: 'SG', name: 'Singapore', phonePrefix: '+65', flag: '🇸🇬' },
  { code: 'MY', name: 'Malaysia', phonePrefix: '+60', flag: '🇲🇾' },
  { code: 'ID', name: 'Indonesia', phonePrefix: '+62', flag: '🇮🇩' },
  { code: 'PH', name: 'Philippines', phonePrefix: '+63', flag: '🇵🇭' },
  { code: 'AE', name: 'United Arab Emirates', phonePrefix: '+971', flag: '🇦🇪' },
  { code: 'SA', name: 'Saudi Arabia', phonePrefix: '+966', flag: '🇸🇦' },
  { code: 'QA', name: 'Qatar', phonePrefix: '+974', flag: '🇶🇦' },
  { code: 'KW', name: 'Kuwait', phonePrefix: '+965', flag: '🇰🇼' },
  { code: 'BH', name: 'Bahrain', phonePrefix: '+973', flag: '🇧🇭' },
  { code: 'OM', name: 'Oman', phonePrefix: '+968', flag: '🇴🇲' },
  { code: 'JO', name: 'Jordan', phonePrefix: '+962', flag: '🇯🇴' },
  { code: 'LB', name: 'Lebanon', phonePrefix: '+961', flag: '🇱🇧' },
  { code: 'SY', name: 'Syria', phonePrefix: '+963', flag: '🇸🇾' },
  { code: 'IQ', name: 'Iraq', phonePrefix: '+964', flag: '🇮🇶' },
  { code: 'IR', name: 'Iran', phonePrefix: '+98', flag: '🇮🇷' },
  { code: 'AF', name: 'Afghanistan', phonePrefix: '+93', flag: '🇦🇫' },
  { code: 'PK', name: 'Pakistan', phonePrefix: '+92', flag: '🇵🇰' },
  { code: 'BD', name: 'Bangladesh', phonePrefix: '+880', flag: '🇧🇩' },
  { code: 'LK', name: 'Sri Lanka', phonePrefix: '+94', flag: '🇱🇰' },
  { code: 'NP', name: 'Nepal', phonePrefix: '+977', flag: '🇳🇵' },
  { code: 'BT', name: 'Bhutan', phonePrefix: '+975', flag: '🇧🇹' },
  { code: 'MV', name: 'Maldives', phonePrefix: '+960', flag: '🇲🇻' }
];

export const getCountryByCode = (code: string): Country | undefined => {
  return COUNTRIES.find(country => country.code === code);
};

export const getCountryByPhonePrefix = (prefix: string): Country | undefined => {
  return COUNTRIES.find(country => country.phonePrefix === prefix);
};

export const searchCountries = (query: string): Country[] => {
  if (!query) return COUNTRIES;

  const lowerQuery = query.toLowerCase();
  return COUNTRIES.filter(country =>
    country.name.toLowerCase().includes(lowerQuery) ||
    country.code.toLowerCase().includes(lowerQuery) ||
    country.phonePrefix.includes(query)
  );
};