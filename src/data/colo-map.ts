/** Cloudflare data center IATA code to city name mapping. */
export const COLO_MAP: Record<string, string> = {
  // North America
  ATL: 'Atlanta',
  BOS: 'Boston',
  DEN: 'Denver',
  DFW: 'Dallas-Fort Worth',
  EWR: 'Newark',
  IAD: 'Ashburn',
  IAH: 'Houston',
  JFK: 'New York',
  LAX: 'Los Angeles',
  MCI: 'Kansas City',
  MIA: 'Miami',
  MSP: 'Minneapolis',
  ORD: 'Chicago',
  PDX: 'Portland',
  PHX: 'Phoenix',
  SEA: 'Seattle',
  SFO: 'San Francisco',
  SJC: 'San Jose',
  SLC: 'Salt Lake City',
  YUL: 'Montreal',
  YVR: 'Vancouver',
  YYZ: 'Toronto',

  // Europe
  AMS: 'Amsterdam',
  ARN: 'Stockholm',
  CDG: 'Paris',
  DUB: 'Dublin',
  FRA: 'Frankfurt',
  HAM: 'Hamburg',
  HEL: 'Helsinki',
  LHR: 'London',
  LIS: 'Lisbon',
  MAD: 'Madrid',
  MAN: 'Manchester',
  MXP: 'Milan',
  WAW: 'Warsaw',
  ZRH: 'Zurich',

  // Asia-Pacific
  BKK: 'Bangkok',
  BOM: 'Mumbai',
  DEL: 'New Delhi',
  HKG: 'Hong Kong',
  ICN: 'Seoul',
  KIX: 'Osaka',
  MEL: 'Melbourne',
  NRT: 'Tokyo',
  SIN: 'Singapore',
  SYD: 'Sydney',
  TPE: 'Taipei',

  // South America
  BOG: 'Bogota',
  EZE: 'Buenos Aires',
  GIG: 'Rio de Janeiro',
  GRU: 'Sao Paulo',
  SCL: 'Santiago',

  // Africa
  CPT: 'Cape Town',
  JNB: 'Johannesburg',
  LOS: 'Lagos',

  // Middle East
  DOH: 'Doha',
  DXB: 'Dubai',
  TLV: 'Tel Aviv',
};

/** Resolve a Cloudflare data center IATA code to a city name. Falls back to raw code. */
export function coloToCity(code: string): string {
  return COLO_MAP[code.toUpperCase()] ?? code;
}
