'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';

interface CraftsmanMapItem {
  id: string;
  full_name: string;
  specialty: string | null;
  is_online: boolean;
  is_verified: boolean;
  rating: number;
  lat: number;
  lng: number;
  distance?: number;
  status?: 'available' | 'busy' | 'offline';
}

interface NearbyMapSectionProps {
  craftsmen: CraftsmanMapItem[];
}

interface Region {
  id: string;
  name: string;
  lat: number;
  lng: number;
  zoom: number;
  locations: Location[];
}

interface Location {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

const REGIONS: Region[] = [
  {
    id: 'riyadh',
    name: 'الرياض',
    lat: 24.7136,
    lng: 46.6753,
    zoom: 12,
    locations: [
      { id: 'riyadh-center', name: 'وسط الرياض', lat: 24.6877, lng: 46.7219 },
      { id: 'olaya', name: 'العليا', lat: 24.6941, lng: 46.6862 },
      { id: 'malaz', name: 'الملز', lat: 24.6800, lng: 46.7300 },
      { id: 'naseem', name: 'النسيم', lat: 24.7100, lng: 46.8000 },
      { id: 'north-riyadh', name: 'شمال الرياض', lat: 24.8000, lng: 46.6500 },
      { id: 'south-riyadh', name: 'جنوب الرياض', lat: 24.5800, lng: 46.7500 },
    ],
  },
  {
    id: 'jeddah',
    name: 'جدة',
    lat: 21.4858,
    lng: 39.1925,
    zoom: 12,
    locations: [
      { id: 'jeddah-center', name: 'وسط جدة', lat: 21.4858, lng: 39.1925 },
      { id: 'corniche', name: 'الكورنيش', lat: 21.5433, lng: 39.1728 },
      { id: 'balad', name: 'البلد', lat: 21.4900, lng: 39.1870 },
    ],
  },
  {
    id: 'mecca',
    name: 'مكة المكرمة',
    lat: 21.3891,
    lng: 39.8579,
    zoom: 12,
    locations: [
      { id: 'mecca-center', name: 'وسط مكة', lat: 21.3891, lng: 39.8579 },
      { id: 'aziziyah', name: 'العزيزية', lat: 21.3700, lng: 39.8800 },
    ],
  },
  {
    id: 'medina',
    name: 'المدينة المنورة',
    lat: 24.5247,
    lng: 39.5692,
    zoom: 12,
    locations: [
      { id: 'medina-center', name: 'وسط المدينة', lat: 24.5247, lng: 39.5692 },
      { id: 'quba', name: 'قباء', lat: 24.4400, lng: 39.6100 },
    ],
  },
  {
    id: 'dammam',
    name: 'الدمام',
    lat: 26.4207,
    lng: 50.0888,
    zoom: 12,
    locations: [
      { id: 'dammam-center', name: 'وسط الدمام', lat: 26.4207, lng: 50.0888 },
      { id: 'khobar', name: 'الخبر', lat: 26.2172, lng: 50.1971 },
    ],
  },
  {
    id: 'taif',
    name: 'الطائف',
    lat: 21.2703,
    lng: 40.4158,
    zoom: 12,
    locations: [
      { id: 'taif-center', name: 'وسط الطائف', lat: 21.2703, lng: 40.4158 },
    ],
  },
];

const DEFAULT_REGION = REGIONS[0];
const LOGO_GREEN = '#2E7D32';

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function NearbyMapSection({ craftsmen }: NearbyMapSectionProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const userMarkerRef = useRef<any>(null);

  const [selectedRegion, setSelectedRegion] = useState<Region>(DEFAULT_REGION);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [modalStep, setModalStep] = useState<'region' | 'location'>('region');
  const [pendingRegion, setPendingRegion] = useState<Region>(DEFAULT_REGION);

  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [nearbyCraftsmen, setNearbyCraftsmen] = useState<CraftsmanMapItem[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [mapKey, setMapKey] = useState(0);

  const handleRefreshMap = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }
    markersRef.current = [];
    userMarkerRef.current = null;
    setMapReady(false);
    setMapKey((k) => k + 1);
  };

  // Initialize map once
  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current) return;

    import('leaflet').then((L) => {
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      });

      if (!mapRef.current || mapInstanceRef.current) return;

      mapInstanceRef.current = L.map(mapRef.current, {
        center: [DEFAULT_REGION.lat, DEFAULT_REGION.lng],
        zoom: DEFAULT_REGION.zoom,
        zoomControl: true,
        attributionControl: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(mapInstanceRef.current);

      // Force map to recalculate its size after mounting
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 100);

      setMapReady(true);
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Pan map when region or location changes
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;
    const target = selectedLocation
      ? { lat: selectedLocation.lat, lng: selectedLocation.lng, zoom: 15 }
      : { lat: selectedRegion.lat, lng: selectedRegion.lng, zoom: selectedRegion.zoom };
    mapInstanceRef.current.setView([target.lat, target.lng], target.zoom, { animate: true });
  }, [mapReady, selectedRegion, selectedLocation]);

  // Update craftsmen markers
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;

    import('leaflet').then((L) => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      const refPoint = userLocation
        ? userLocation
        : selectedLocation
        ? { lat: selectedLocation.lat, lng: selectedLocation.lng }
        : { lat: selectedRegion.lat, lng: selectedRegion.lng };

      let sorted = craftsmen
        .map((c) => ({
          ...c,
          distance: haversineDistance(refPoint.lat, refPoint.lng, c.lat, c.lng),
        }))
        .sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999));

      setNearbyCraftsmen(sorted);

      sorted.forEach((craftsman) => {
        const isOnline = craftsman.is_online;
        const isBusy = craftsman.status === 'busy';
        const bgColor = isBusy ? '#D97706' : isOnline ? '#059669' : '#6b7280';
        const borderColor = isBusy ? '#FCD34D' : isOnline ? '#34d399' : '#9ca3af';
        const dotColor = isBusy ? '#F59E0B' : isOnline ? '#22c55e' : '#9ca3af';
        const statusLabel = isBusy ? '🟡 مشغول' : isOnline ? '🟢 متاح الآن' : '⚫ غير متصل';

        const svgIcon = `
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="50" viewBox="0 0 44 54">
            <path d="M22 0C10.954 0 2 8.954 2 20c0 13 20 34 20 34s20-21 20-34C42 8.954 33.046 0 22 0z" fill="${bgColor}" stroke="${borderColor}" stroke-width="2"/>
            <circle cx="22" cy="19" r="13" fill="white"/>
            <rect x="15" y="25" width="14" height="8" rx="3" fill="${bgColor}"/>
            <circle cx="22" cy="20" r="5" fill="${bgColor}"/>
            <rect x="13" y="15" width="18" height="3" rx="1.5" fill="${bgColor}"/>
            <path d="M16 15 Q22 9 28 15" fill="${bgColor}" stroke="${bgColor}" stroke-width="1"/>
            <circle cx="33" cy="9" r="4" fill="${dotColor}" stroke="white" stroke-width="1.5"/>
          </svg>
        `;

        const icon = L.divIcon({
          html: svgIcon,
          className: '',
          iconSize: [40, 50],
          iconAnchor: [20, 50],
          popupAnchor: [0, -50],
        });

        const distText =
          craftsman.distance != null
            ? `<p style="font-size:11px;color:#059669;margin:2px 0;">📍 ${craftsman.distance.toFixed(1)} كم</p>`
            : '';

        const popupContent = `
          <div style="font-family:'Cairo',sans-serif;direction:rtl;min-width:160px;padding:4px;">
            <strong style="font-size:13px;color:#111;">${craftsman.full_name}</strong>
            ${craftsman.specialty ? `<p style="font-size:11px;color:#555;margin:2px 0;">${craftsman.specialty}</p>` : ''}
            <p style="font-size:11px;color:#555;margin:2px 0;">⭐ ${craftsman.rating.toFixed(1)}</p>
            ${distText}
            <p style="font-size:11px;color:${isBusy ? '#D97706' : isOnline ? '#059669' : '#9ca3af'};margin:4px 0;font-weight:600;">${statusLabel}</p>
            <a href="/craftsman-profile?id=${craftsman.id}" style="display:block;margin-top:8px;padding:6px;background:${LOGO_GREEN};color:white;border-radius:8px;font-size:11px;font-weight:600;text-align:center;text-decoration:none;">عرض الملف</a>
          </div>
        `;

        const marker = L.marker([craftsman.lat, craftsman.lng], { icon });
        marker.bindPopup(popupContent, { maxWidth: 200 });
        marker.addTo(mapInstanceRef.current);
        markersRef.current.push(marker);
      });
    });
  }, [mapReady, craftsmen, userLocation, selectedRegion, selectedLocation]);

  // Update user location marker
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !userLocation) return;

    import('leaflet').then((L) => {
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }

      const userSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="16" fill="#1565C0" stroke="white" stroke-width="3"/>
          <circle cx="18" cy="18" r="6" fill="white"/>
          <circle cx="18" cy="18" r="16" fill="none" stroke="#1565C0" stroke-width="1" opacity="0.3"/>
        </svg>
      `;

      const userIcon = L.divIcon({
        html: userSvg,
        className: '',
        iconSize: [36, 36],
        iconAnchor: [18, 18],
        popupAnchor: [0, -18],
      });

      userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon });
      userMarkerRef.current.bindPopup(
        '<div style="font-family:Cairo,sans-serif;direction:rtl;font-size:12px;font-weight:600;color:#1565C0;">📍 موقعك الحالي</div>'
      );
      userMarkerRef.current.addTo(mapInstanceRef.current);
      mapInstanceRef.current.setView([userLocation.lat, userLocation.lng], 14, { animate: true });
    });
  }, [mapReady, userLocation]);

  const handleLocate = () => {
    if (typeof window === 'undefined') return;
    if (!navigator.geolocation) {
      setLocationError('المتصفح لا يدعم تحديد الموقع');
      return;
    }
    setIsLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setIsLocating(false);
      },
      (err) => {
        setIsLocating(false);
        if (err.code === 1) {
          setLocationError('تم رفض إذن الموقع. يرجى السماح بالوصول للموقع من إعدادات المتصفح ثم المحاولة مجدداً');
        } else if (err.code === 2) {
          setLocationError('تعذّر تحديد موقعك، يرجى التحقق من اتصالك بالإنترنت');
        } else if (err.code === 3) {
          setLocationError('انتهت مهلة تحديد الموقع، يرجى المحاولة مجدداً');
        } else {
          setLocationError('تعذّر تحديد موقعك، يرجى المحاولة مجدداً');
        }
      },
      { timeout: 15000, enableHighAccuracy: true, maximumAge: 60000 }
    );
  };

  const handleRegionSelect = (region: Region) => {
    setPendingRegion(region);
    setModalStep('location');
  };

  const handleLocationSelect = (loc: Location | null) => {
    setSelectedRegion(pendingRegion);
    setSelectedLocation(loc);
    setUserLocation(null);
    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }
    setShowLocationModal(false);
    setModalStep('region');
  };

  const openModal = () => {
    setPendingRegion(selectedRegion);
    setModalStep('region');
    setShowLocationModal(true);
  };

  const currentLocationLabel = userLocation
    ? 'موقعك الحالي'
    : selectedLocation
    ? `${selectedRegion.name} — ${selectedLocation.name}`
    : `منطقة ${selectedRegion.name}`;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={handleLocate}
          disabled={isLocating}
          className="flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-xl border border-primary text-primary bg-green-50 active:bg-green-100 transition-colors disabled:opacity-60"
        >
          {isLocating ? (
            <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          ) : (
            <Icon name="MapPinIcon" size={14} className="text-primary" />
          )}
          {userLocation ? 'تحديث الموقع' : 'تحديد موقعي'}
        </button>
        <h2 className="text-base font-bold text-gray-900">الحِرَفيون بالقرب منك</h2>
      </div>

      {locationError && (
        <div className="mb-2 px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 text-right">
          {locationError}
        </div>
      )}

      {/* Map container — position relative so overlay button sits on top */}
      <div className="relative isolate rounded-2xl overflow-hidden border border-gray-200 shadow-sm" style={{ height: 280 }}>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
        <div key={mapKey} ref={mapRef} style={{ width: '100%', height: '100%' }} />

        {/* City selector overlay button — sits on top of the map */}
        <button
          onClick={openModal}
          className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white shadow-md border border-gray-200 text-sm font-semibold text-gray-800 active:bg-gray-50 transition-colors"
          style={{ zIndex: 1000 }}
        >
          <Icon name="MapPinIcon" size={14} className="text-primary" />
          <span className="max-w-[140px] truncate">{currentLocationLabel}</span>
          <Icon name="ChevronDownIcon" size={13} className="text-gray-500" />
        </button>
      </div>

      {/* Location Modal — fixed overlay above everything */}
      {showLocationModal && (
        <div
          className="fixed inset-0 flex items-end justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 9999 }}
          onClick={() => { setShowLocationModal(false); setModalStep('region'); }}
        >
          <div
            className="w-full bg-white rounded-t-2xl pb-6 pt-4 px-4 max-h-[70vh] overflow-y-auto"
            style={{ zIndex: 10000 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4" />

            {modalStep === 'region' ? (
              <>
                <h3 className="text-base font-bold text-gray-900 text-right mb-3">اختر المدينة</h3>
                <div className="flex flex-col gap-1">
                  {REGIONS.map((region) => (
                    <button
                      key={region.id}
                      onClick={() => handleRegionSelect(region)}
                      className={`w-full text-right px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                        selectedRegion.id === region.id
                          ? 'bg-green-50 text-primary font-bold border border-green-200' :'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {region.name}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <button
                    onClick={() => setModalStep('region')}
                    className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <Icon name="ChevronRightIcon" size={16} className="text-gray-600" />
                  </button>
                  <h3 className="text-base font-bold text-gray-900 flex-1 text-right">
                    اختر الموقع في {pendingRegion.name}
                  </h3>
                </div>
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => handleLocationSelect(null)}
                    className={`w-full text-right px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                      !selectedLocation && selectedRegion.id === pendingRegion.id
                        ? 'bg-green-50 text-primary font-bold border border-green-200' :'text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    كل المنطقة
                  </button>
                  {pendingRegion.locations.map((loc) => (
                    <button
                      key={loc.id}
                      onClick={() => handleLocationSelect(loc)}
                      className={`w-full text-right px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                        selectedLocation?.id === loc.id
                          ? 'bg-green-50 text-primary font-bold border border-green-200' :'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {loc.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Nearby craftsmen list below map */}
      {nearbyCraftsmen.length > 0 && (
        <div className="flex flex-col gap-2 mt-3">
          {nearbyCraftsmen.slice(0, 5).map((craftsman) => (
            <Link key={craftsman.id} href={`/craftsman-profile?id=${craftsman.id}`}>
              <div className="bg-white rounded-xl border border-gray-200 px-3 py-2.5 flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: craftsman.is_online ? '#E8F5E9' : '#F3F4F6' }}
                >
                  <Icon
                    name="WrenchScrewdriverIcon"
                    size={18}
                    className={craftsman.is_online ? 'text-green-700' : 'text-gray-400'}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">{craftsman.full_name}</p>
                  <p className="text-xs text-gray-500 truncate">{craftsman.specialty}</p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-bold text-gray-800">{craftsman.rating.toFixed(1)}</span>
                    <Icon name="StarIcon" size={11} variant="solid" className="text-yellow-500" />
                  </div>
                  {craftsman.distance != null && (
                    <span className="text-xs text-green-700 font-semibold">{craftsman.distance.toFixed(1)} كم</span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
