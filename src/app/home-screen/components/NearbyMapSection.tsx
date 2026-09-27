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
  distance?: number; // km
}

interface NearbyMapSectionProps {
  craftsmen: CraftsmanMapItem[];
}

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

  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [nearbyCraftsmen, setNearbyCraftsmen] = useState<CraftsmanMapItem[]>([]);
  const [mapReady, setMapReady] = useState(false);

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
        center: [24.7136, 46.6753],
        zoom: 12,
        zoomControl: true,
        attributionControl: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(mapInstanceRef.current);

      setMapReady(true);
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update craftsmen markers whenever craftsmen or userLocation changes
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;

    import('leaflet').then((L) => {
      // Remove old craftsman markers
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      let sorted = [...craftsmen];

      if (userLocation) {
        sorted = sorted
          .map((c) => ({
            ...c,
            distance: haversineDistance(userLocation.lat, userLocation.lng, c.lat, c.lng),
          }))
          .sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999))
          .slice(0, 20);
        setNearbyCraftsmen(sorted);
      } else {
        setNearbyCraftsmen(sorted.slice(0, 10));
      }

      sorted.forEach((craftsman) => {
        const isOnline = craftsman.is_online;
        const bgColor = isOnline ? '#059669' : '#6b7280';
        const borderColor = isOnline ? '#34d399' : '#9ca3af';

        const svgIcon = `
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="50" viewBox="0 0 44 54">
            <path d="M22 0C10.954 0 2 8.954 2 20c0 13 20 34 20 34s20-21 20-34C42 8.954 33.046 0 22 0z" fill="${bgColor}" stroke="${borderColor}" stroke-width="2"/>
            <circle cx="22" cy="19" r="13" fill="white"/>
            <rect x="15" y="25" width="14" height="8" rx="3" fill="${bgColor}"/>
            <circle cx="22" cy="20" r="5" fill="${bgColor}"/>
            <rect x="13" y="15" width="18" height="3" rx="1.5" fill="${bgColor}"/>
            <path d="M16 15 Q22 9 28 15" fill="${bgColor}" stroke="${bgColor}" stroke-width="1"/>
            <circle cx="33" cy="9" r="4" fill="${isOnline ? '#22c55e' : '#9ca3af'}" stroke="white" stroke-width="1.5"/>
          </svg>
        `;

        const icon = L.divIcon({
          html: svgIcon,
          className: '',
          iconSize: [40, 50],
          iconAnchor: [20, 50],
          popupAnchor: [0, -50],
        });

        const distText = craftsman.distance != null ? `<p style="font-size:11px;color:#059669;margin:2px 0;">📍 ${craftsman.distance.toFixed(1)} كم</p>` : '';

        const popupContent = `
          <div style="font-family:'Cairo',sans-serif;direction:rtl;min-width:160px;padding:4px;">
            <strong style="font-size:13px;color:#111;">${craftsman.full_name}</strong>
            ${craftsman.specialty ? `<p style="font-size:11px;color:#555;margin:2px 0;">${craftsman.specialty}</p>` : ''}
            <p style="font-size:11px;color:#555;margin:2px 0;">⭐ ${craftsman.rating.toFixed(1)}</p>
            ${distText}
            <p style="font-size:11px;color:${isOnline ? '#059669' : '#9ca3af'};margin:4px 0;font-weight:600;">${isOnline ? '🟢 متاح الآن' : '⚫ غير متصل'}</p>
            <a href="/craftsman-profile?id=${craftsman.id}" style="display:block;margin-top:8px;padding:6px;background:${LOGO_GREEN};color:white;border-radius:8px;font-size:11px;font-weight:600;text-align:center;text-decoration:none;">عرض الملف</a>
          </div>
        `;

        const marker = L.marker([craftsman.lat, craftsman.lng], { icon });
        marker.bindPopup(popupContent, { maxWidth: 200 });
        marker.addTo(mapInstanceRef.current);
        markersRef.current.push(marker);
      });
    });
  }, [mapReady, craftsmen, userLocation]);

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
      userMarkerRef.current.bindPopup('<div style="font-family:Cairo,sans-serif;direction:rtl;font-size:12px;font-weight:600;color:#1565C0;">📍 موقعك الحالي</div>');
      userMarkerRef.current.addTo(mapInstanceRef.current);

      // Pan map to user location
      mapInstanceRef.current.setView([userLocation.lat, userLocation.lng], 13, { animate: true });
    });
  }, [mapReady, userLocation]);

  const handleLocate = () => {
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
      () => {
        setLocationError('تعذّر تحديد موقعك، يرجى السماح بالوصول للموقع');
        setIsLocating(false);
      },
      { timeout: 10000 }
    );
  };

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
        <h2 className="text-base font-bold text-gray-900">الصنايعية بالقرب منك</h2>
      </div>

      {locationError && (
        <div className="mb-2 px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 text-right">
          {locationError}
        </div>
      )}

      {userLocation && (
        <div className="mb-2 px-3 py-2 bg-green-50 border border-green-200 rounded-xl text-xs text-green-700 text-right flex items-center gap-1.5">
          <Icon name="MapPinIcon" size={12} className="text-green-600" />
          تم تحديد موقعك — يتم عرض أقرب الصنايعية إليك
        </div>
      )}

      {/* Map */}
      <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm mb-3" style={{ height: 280 }}>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"
        />
        <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
      </div>

      {/* Nearby craftsmen list below map */}
      {nearbyCraftsmen.length > 0 && (
        <div className="flex flex-col gap-2">
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
