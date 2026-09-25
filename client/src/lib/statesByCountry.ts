/**
 * States/provinces/regions for the countries where Valtireo's customers are
 * most likely based (government, healthcare, schools, NGOs, manufacturing,
 * professional services — see docs/valtireo-brand-product-design-foundation-v1.md).
 * Keys must match `COUNTRIES` in lib/countries.ts exactly.
 *
 * This is intentionally a curated subset, not exhaustive global coverage —
 * any country not listed here falls back to a free-text state field.
 */
export const STATES_BY_COUNTRY: Record<string, string[]> = {
  Nigeria: [
    'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno', 'Cross River', 'Delta',
    'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'Federal Capital Territory', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano',
    'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau',
    'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara',
  ],
  'United States': [
    'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware',
    'District of Columbia', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas',
    'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi',
    'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico', 'New York',
    'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island',
    'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington',
    'West Virginia', 'Wisconsin', 'Wyoming',
  ],
  'United Kingdom': ['England', 'Scotland', 'Wales', 'Northern Ireland'],
  Canada: [
    'Alberta', 'British Columbia', 'Manitoba', 'New Brunswick', 'Newfoundland and Labrador',
    'Northwest Territories', 'Nova Scotia', 'Nunavut', 'Ontario', 'Prince Edward Island', 'Quebec',
    'Saskatchewan', 'Yukon',
  ],
  India: [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana',
    'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
    'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana',
    'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh',
    'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
  ],
  'South Africa': [
    'Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo', 'Mpumalanga', 'North West',
    'Northern Cape', 'Western Cape',
  ],
  Kenya: [
    'Baringo', 'Bomet', 'Bungoma', 'Busia', 'Elgeyo-Marakwet', 'Embu', 'Garissa', 'Homa Bay', 'Isiolo',
    'Kajiado', 'Kakamega', 'Kericho', 'Kiambu', 'Kilifi', 'Kirinyaga', 'Kisii', 'Kisumu', 'Kitui', 'Kwale',
    'Laikipia', 'Lamu', 'Machakos', 'Makueni', 'Mandera', 'Marsabit', 'Meru', 'Migori', 'Mombasa', "Murang'a",
    'Nairobi', 'Nakuru', 'Nandi', 'Narok', 'Nyamira', 'Nyandarua', 'Nyeri', 'Samburu', 'Siaya', 'Taita-Taveta',
    'Tana River', 'Tharaka-Nithi', 'Trans Nzoia', 'Turkana', 'Uasin Gishu', 'Vihiga', 'Wajir', 'West Pokot',
  ],
  Ghana: [
    'Ahafo', 'Ashanti', 'Bono', 'Bono East', 'Central', 'Eastern', 'Greater Accra', 'North East', 'Northern',
    'Oti', 'Savannah', 'Upper East', 'Upper West', 'Volta', 'Western', 'Western North',
  ],
  Uganda: ['Central', 'Eastern', 'Northern', 'Western'],
  Rwanda: ['Kigali', 'Eastern Province', 'Northern Province', 'Southern Province', 'Western Province'],
  Zambia: [
    'Central', 'Copperbelt', 'Eastern', 'Luapula', 'Lusaka', 'Muchinga', 'North-Western', 'Northern',
    'Southern', 'Western',
  ],
  Zimbabwe: [
    'Bulawayo', 'Harare', 'Manicaland', 'Mashonaland Central', 'Mashonaland East', 'Mashonaland West',
    'Masvingo', 'Matabeleland North', 'Matabeleland South', 'Midlands',
  ],
  Egypt: [
    'Alexandria', 'Aswan', 'Asyut', 'Beheira', 'Beni Suef', 'Cairo', 'Dakahlia', 'Damietta', 'Faiyum',
    'Gharbia', 'Giza', 'Ismailia', 'Kafr El Sheikh', 'Luxor', 'Matruh', 'Minya', 'Monufia', 'New Valley',
    'North Sinai', 'Port Said', 'Qalyubia', 'Qena', 'Red Sea', 'Sharqia', 'Sohag', 'South Sinai', 'Suez',
  ],
  'United Arab Emirates': [
    'Abu Dhabi', 'Ajman', 'Dubai', 'Fujairah', 'Ras Al Khaimah', 'Sharjah', 'Umm Al Quwain',
  ],
  'Saudi Arabia': [
    'Al Bahah', 'Al Jawf', 'Al Madinah', 'Al Qassim', 'Asir', 'Eastern Province', 'Hail', 'Jazan', 'Makkah',
    'Najran', 'Northern Borders', 'Riyadh', 'Tabuk',
  ],
  Pakistan: [
    'Balochistan', 'Khyber Pakhtunkhwa', 'Punjab', 'Sindh', 'Azad Kashmir', 'Gilgit-Baltistan',
    'Islamabad Capital Territory',
  ],
  Bangladesh: ['Barishal', 'Chattogram', 'Dhaka', 'Khulna', 'Mymensingh', 'Rajshahi', 'Rangpur', 'Sylhet'],
  Australia: [
    'Australian Capital Territory', 'New South Wales', 'Northern Territory', 'Queensland', 'South Australia',
    'Tasmania', 'Victoria', 'Western Australia',
  ],
  'New Zealand': [
    'Auckland', 'Bay of Plenty', 'Canterbury', 'Gisborne', "Hawke's Bay", 'Manawatū-Whanganui', 'Marlborough',
    'Nelson', 'Northland', 'Otago', 'Southland', 'Taranaki', 'Tasman', 'Waikato', 'Wellington', 'West Coast',
  ],
  Germany: [
    'Baden-Württemberg', 'Bavaria', 'Berlin', 'Brandenburg', 'Bremen', 'Hamburg', 'Hesse', 'Lower Saxony',
    'Mecklenburg-Vorpommern', 'North Rhine-Westphalia', 'Rhineland-Palatinate', 'Saarland', 'Saxony',
    'Saxony-Anhalt', 'Schleswig-Holstein', 'Thuringia',
  ],
  France: [
    'Auvergne-Rhône-Alpes', 'Bourgogne-Franche-Comté', 'Bretagne', 'Centre-Val de Loire', 'Corse', 'Grand Est',
    'Hauts-de-France', 'Île-de-France', 'Normandie', 'Nouvelle-Aquitaine', 'Occitanie', 'Pays de la Loire',
    "Provence-Alpes-Côte d'Azur", 'Guadeloupe', 'Martinique', 'Guyane', 'La Réunion', 'Mayotte',
  ],
  Spain: [
    'Andalusia', 'Aragon', 'Asturias', 'Balearic Islands', 'Basque Country', 'Canary Islands', 'Cantabria',
    'Castile and León', 'Castile-La Mancha', 'Catalonia', 'Extremadura', 'Galicia', 'La Rioja', 'Madrid',
    'Murcia', 'Navarre', 'Valencian Community',
  ],
  Italy: [
    'Abruzzo', 'Aosta Valley', 'Apulia', 'Basilicata', 'Calabria', 'Campania', 'Emilia-Romagna',
    'Friuli-Venezia Giulia', 'Lazio', 'Liguria', 'Lombardy', 'Marche', 'Molise', 'Piedmont', 'Sardinia',
    'Sicily', 'Trentino-Alto Adige', 'Tuscany', 'Umbria', 'Veneto',
  ],
  Netherlands: [
    'Drenthe', 'Flevoland', 'Friesland', 'Gelderland', 'Groningen', 'Limburg', 'North Brabant', 'North Holland',
    'Overijssel', 'South Holland', 'Utrecht', 'Zeeland',
  ],
  Switzerland: [
    'Aargau', 'Appenzell Ausserrhoden', 'Appenzell Innerrhoden', 'Basel-Landschaft', 'Basel-Stadt', 'Bern',
    'Fribourg', 'Geneva', 'Glarus', 'Graubünden', 'Jura', 'Lucerne', 'Neuchâtel', 'Nidwalden', 'Obwalden',
    'Schaffhausen', 'Schwyz', 'Solothurn', 'St. Gallen', 'Thurgau', 'Ticino', 'Uri', 'Valais', 'Vaud', 'Zug',
    'Zürich',
  ],
  Ireland: [
    'Carlow', 'Cavan', 'Clare', 'Cork', 'Donegal', 'Dublin', 'Galway', 'Kerry', 'Kildare', 'Kilkenny', 'Laois',
    'Leitrim', 'Limerick', 'Longford', 'Louth', 'Mayo', 'Meath', 'Monaghan', 'Offaly', 'Roscommon', 'Sligo',
    'Tipperary', 'Waterford', 'Westmeath', 'Wexford', 'Wicklow',
  ],
  Malaysia: [
    'Johor', 'Kedah', 'Kelantan', 'Malacca', 'Negeri Sembilan', 'Pahang', 'Penang', 'Perak', 'Perlis', 'Sabah',
    'Sarawak', 'Selangor', 'Terengganu', 'Kuala Lumpur', 'Labuan', 'Putrajaya',
  ],
  Brazil: [
    'Acre', 'Alagoas', 'Amapá', 'Amazonas', 'Bahia', 'Ceará', 'Distrito Federal', 'Espírito Santo', 'Goiás',
    'Maranhão', 'Mato Grosso', 'Mato Grosso do Sul', 'Minas Gerais', 'Pará', 'Paraíba', 'Paraná', 'Pernambuco',
    'Piauí', 'Rio de Janeiro', 'Rio Grande do Norte', 'Rio Grande do Sul', 'Rondônia', 'Roraima',
    'Santa Catarina', 'São Paulo', 'Sergipe', 'Tocantins',
  ],
  Mexico: [
    'Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche', 'Chiapas', 'Chihuahua',
    'Ciudad de México', 'Coahuila', 'Colima', 'Durango', 'Guanajuato', 'Guerrero', 'Hidalgo', 'Jalisco',
    'México', 'Michoacán', 'Morelos', 'Nayarit', 'Nuevo León', 'Oaxaca', 'Puebla', 'Querétaro', 'Quintana Roo',
    'San Luis Potosí', 'Sinaloa', 'Sonora', 'Tabasco', 'Tamaulipas', 'Tlaxcala', 'Veracruz', 'Yucatán',
    'Zacatecas',
  ],
};

export function hasCuratedStates(country: string): boolean {
  return Object.prototype.hasOwnProperty.call(STATES_BY_COUNTRY, country);
}
