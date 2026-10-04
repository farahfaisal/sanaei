'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
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

interface MapBlockProps {
  craftsmen: CraftsmanMapItem[];
}

const PRIMARY = '#1a6b3c';
const PRIMARY_LIGHT = '#2e8b57';
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

const DEFAULT_CENTER = { lat: 24.7136, lng: 46.6753, zoom: 12 };

export default function MapBlock({ craftsmen }: MapBlockProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const userMarkerRef = useRef<any>(null);

  const [mapReady, setMapReady] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [nearbyCraftsmen, setNearbyCraftsmen] = useState<CraftsmanMapItem[]>([]);
  const [mapKey, setMapKey] = useState(0);

  // Init map
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
        center: [DEFAULT_CENTER.lat, DEFAULT_CENTER.lng],
        zoom: DEFAULT_CENTER.zoom,
        zoomControl: true,
        attributionControl: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(mapInstanceRef.current);

      setTimeout(() => {
        if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
      }, 150);

      setMapReady(true);
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [mapKey]);

  // Place craftsmen markers
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;

    import('leaflet').then((L) => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      const refPoint = userLocation ?? { lat: DEFAULT_CENTER.lat, lng: DEFAULT_CENTER.lng };

      const sorted = craftsmen
        .map((c) => ({ ...c, distance: haversineDistance(refPoint.lat, refPoint.lng, c.lat, c.lng) }))
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
          </svg>`;

        const icon = L.divIcon({ html: svgIcon, className: '', iconSize: [40, 50], iconAnchor: [20, 50], popupAnchor: [0, -50] });

        const distText = craftsman.distance != null
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
          </div>`;

        const marker = L.marker([craftsman.lat, craftsman.lng], { icon });
        marker.bindPopup(popupContent, { maxWidth: 200 });
        marker.addTo(mapInstanceRef.current);
        markersRef.current.push(marker);
      });
    });
  }, [mapReady, craftsmen, userLocation]);

  // User location marker
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !userLocation) return;

    import('leaflet').then((L) => {
      if (userMarkerRef.current) { userMarkerRef.current.remove(); userMarkerRef.current = null; }

      const userSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="16" fill="#1565C0" stroke="white" stroke-width="3"/>
          <circle cx="18" cy="18" r="6" fill="white"/>
        </svg>`;

      const userIcon = L.divIcon({ html: userSvg, className: '', iconSize: [36, 36], iconAnchor: [18, 18], popupAnchor: [0, -18] });
      userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon });
      userMarkerRef.current.bindPopup('<div style="font-family:Cairo,sans-serif;direction:rtl;font-size:12px;font-weight:600;color:#1565C0;">📍 موقعك الحالي</div>');
      userMarkerRef.current.addTo(mapInstanceRef.current);
      mapInstanceRef.current.setView([userLocation.lat, userLocation.lng], 14, { animate: true });
    });
  }, [mapReady, userLocation]);

  const handleLocate = useCallback(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
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
        if (err.code === 1) setLocationError('تم رفض إذن الموقع. يرجى السماح بالوصول من إعدادات المتصفح');
        else if (err.code === 2) setLocationError('تعذّر تحديد موقعك، تحقق من اتصالك');
        else setLocationError('تعذّر تحديد موقعك، حاول مجدداً');
      },
      { timeout: 15000, enableHighAccuracy: true, maximumAge: 60000 }
    );
  }, []);

  const onlineCraftsmenNearby = nearbyCraftsmen.filter((c) => c.is_online).slice(0, 5);

  return (
    <div
      className="rounded-3xl overflow-hidden"
      style={{ background: 'white', boxShadow: '0 4px 24px rgba(0,0,0,0.10)', border: '1px solid #e8ecef' }}
      dir="rtl"
    >
      {/* Block Header */}
      <div
        className="flex items-center justify-between px-4 py-3.5"
        style={{ background: `linear-gradient(135deg, ${PRIMARY} 0%, ${PRIMARY_LIGHT} 100%)` }}
      >
        <button
          onClick={handleLocate}
          disabled={isLocating}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-60"
          style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.3)', color: 'white', backdropFilter: 'blur(4px)' }}
        >
          {isLocating ? (
            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Icon name="MapPinIcon" size={14} className="text-white" />
          )}
          {userLocation ? 'تحديث موقعي' : 'تحديد موقعي'}
        </button>

        <div className="flex items-center gap-2">
          <div>
            <h2 className="text-sm font-bold text-white text-right">الصنايعية القريبون منك</h2>
            <p className="text-xs text-right" style={{ color: 'rgba(255,255,255,0.7)' }}>
              {onlineCraftsmenNearby.length} متاح الآن بالقرب منك
            </p>
          </div>
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.15)' }}
          >
            <Icon name="MapIcon" size={18} className="text-white" />
          </div>
        </div>
      </div>

      {/* Error banner */}
      {locationError && (
        <div className="mx-3 mt-3 px-3 py-2 rounded-xl text-xs text-right" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }}>
          {locationError}
        </div>
      )}

      {/* Map */}
      <div className="relative" style={{ height: 300 }}>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
        <div key={mapKey} ref={mapRef} style={{ width: '100%', height: '100%' }} />

        {/* Refresh button overlay */}
        <button
          onClick={() => {
            if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }
            markersRef.current = [];
            userMarkerRef.current = null;
            setMapReady(false);
            setMapKey((k) => k + 1);
          }}
          className="absolute top-3 left-3 w-9 h-9 rounded-xl flex items-center justify-center bg-white shadow-md border border-gray-200 active:bg-gray-50 transition-colors"
          style={{ zIndex: 1000 }}
          title="تحديث الخريطة"
        >
          <Icon name="ArrowPathIcon" size={16} className="text-gray-600" />
        </button>

        {/* User location indicator */}
        {userLocation && (
          <div
            className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white shadow-md border border-blue-200"
            style={{ zIndex: 1000 }}
          >
            <div className="w-2.5 h-2.5 rounded-full bg-blue-600" style={{ boxShadow: '0 0 6px #2563eb80' }} />
            <span className="text-xs font-semibold text-blue-700">موقعك الحالي</span>
          </div>
        )}
      </div>

      {/* Nearby craftsmen list */}
      {nearbyCraftsmen.length > 0 && (
        <div className="px-3 pb-3 pt-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold" style={{ color: PRIMARY }}>عرض الكل</span>
            <span className="text-xs font-bold text-gray-700">أقرب الصنايعية</span>
          </div>
          <div className="flex flex-col gap-2">
            {nearbyCraftsmen.slice(0, 4).map((craftsman) => (
              <Link key={craftsman.id} href={`/craftsman-profile?id=${craftsman.id}`}>
                <div
                  className="flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all active:scale-98"
                  style={{ background: '#f8fafb', border: '1px solid #eef0f2' }}
                >
                  {/* Status dot + icon */}
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: craftsman.is_online ? '#e8f5ee' : '#f3f4f6' }}
                  >
                    <Icon
                      name="WrenchScrewdriverIcon"
                      size={20}
                      style={{ color: craftsman.is_online ? PRIMARY : '#9ca3af' }}
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <p className="text-sm font-bold text-gray-900 truncate">{craftsman.full_name}</p>
                      {craftsman.is_online && (
                        <span className="text-xs font-semibold" style={{ color: '#16a34a' }}>● متاح</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate">{craftsman.specialty}</p>
                  </div>

                  {/* Rating + distance */}
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-bold text-gray-800">{craftsman.rating.toFixed(1)}</span>
                      <Icon name="StarIcon" size={11} variant="solid" className="text-yellow-500" />
                    </div>
                    {craftsman.distance != null && (
                      <span className="text-xs font-semibold" style={{ color: PRIMARY }}>
                        {craftsman.distance.toFixed(1)} كم
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
