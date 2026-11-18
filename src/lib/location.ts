// Location helpers shared by the home screen and the dashboard map.
//
// A craftsman or customer location can be stored as "lat,lng" or as text
// (e.g. "البيرة" or "مخماس، بيتونيا، رام الله"). Text is matched against the
// neighbourhoods below. Anything that cannot be placed returns null, so the UI
// shows "distance unknown" instead of inventing a position.
//
// Coordinates are approximate neighbourhood centres.

export const RAMALLAH_CENTER = { lat: 31.9038, lng: 35.2034, zoom: 13 };

// Order matters: neighbourhoods first, the city last, so a specific area wins.
const PLACES: { names: string[]; lat: number; lng: number }[] = [
  { names: ['البيرة'], lat: 31.9097, lng: 35.2219 },
  { names: ['بيتونيا'], lat: 31.9447, lng: 35.1956 },
  { names: ['الطيرة'], lat: 31.9042, lng: 35.1900 },
  { names: ['المصيون'], lat: 31.8995, lng: 35.1930 },
  { names: ['مخماس'], lat: 31.9365, lng: 35.2433 },
  { names: ['رام الله', 'رام اللّه', 'Ramallah'], lat: RAMALLAH_CENTER.lat, lng: RAMALLAH_CENTER.lng },
];

export function parseLocation(location: string | null | undefined): { lat: number; lng: number } | null {
  if (!location) return null;
  const parts = location.split(',');
  if (parts.length === 2) {
    const lat = parseFloat(parts[0].trim());
    const lng = parseFloat(parts[1].trim());
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
  }
  for (const place of PLACES) {
    if (place.names.some((n) => location.includes(n))) return { lat: place.lat, lng: place.lng };
  }
  return null;
}

export function calcDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
