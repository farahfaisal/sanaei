'use client';

import React, { useEffect, useRef } from 'react';
import type { CraftsmanMapData } from './MapTab';

interface MapComponentProps {
  craftsmen: CraftsmanMapData[];
  onCraftsmanSelect: (craftsman: CraftsmanMapData) => void;
  onAssignOrder: (craftsmanId: string) => void;
}

export default function MapComponent({ craftsmen, onCraftsmanSelect, onAssignOrder }: MapComponentProps) {
  const mapRef = useRef<any>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Dynamically import leaflet to avoid SSR issues
    import('leaflet').then((L) => {
      // Fix default icon paths
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      });

      if (!mapRef.current) return;

      // Initialize map only once
      if (!mapInstanceRef.current) {
        mapInstanceRef.current = L.map(mapRef.current, {
          center: [24.7136, 46.6753], // Riyadh center
          zoom: 11,
          zoomControl: true,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(mapInstanceRef.current);
      }

      // Clear existing markers
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      // Add craftsman markers
      craftsmen.forEach((craftsman) => {
        if (craftsman.lat === null || craftsman.lng === null) return;

        const isOnline = craftsman.is_online;
        const color = isOnline ? '#10b981' : '#6b7280';

        const svgIcon = `
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
            <path d="M16 0C7.163 0 0 7.163 0 16c0 10 16 24 16 24s16-14 16-24C32 7.163 24.837 0 16 0z" fill="${color}" stroke="white" stroke-width="2"/>
            <circle cx="16" cy="16" r="8" fill="white" opacity="0.9"/>
            <text x="16" y="20" text-anchor="middle" font-size="10" fill="${color}">🔧</text>
          </svg>
        `;

        const icon = L.divIcon({
          html: svgIcon,
          className: '',
          iconSize: [32, 40],
          iconAnchor: [16, 40],
          popupAnchor: [0, -40],
        });

        const marker = L.marker([craftsman.lat!, craftsman.lng!], { icon });

        const popupContent = `
          <div style="font-family: 'Cairo', sans-serif; direction: rtl; min-width: 180px; padding: 4px;">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
              <div style="width:8px; height:8px; border-radius:50%; background:${color}; flex-shrink:0;"></div>
              <strong style="font-size:13px; color:#111;">${craftsman.full_name}</strong>
            </div>
            ${craftsman.specialty ? `<p style="font-size:11px; color:#555; margin:2px 0;">التخصص: ${craftsman.specialty}</p>` : ''}
            <p style="font-size:11px; color:#555; margin:2px 0;">التقييم: ⭐ ${craftsman.rating.toFixed(1)}</p>
            <p style="font-size:11px; color:#555; margin:2px 0;">الوظائف: ${craftsman.completed_jobs}</p>
            <p style="font-size:11px; color:${isOnline ? '#059669' : '#9ca3af'}; margin:4px 0; font-weight:600;">${isOnline ? '🟢 متصل' : '⚫ غير متصل'}</p>
            <button 
              onClick="window.__assignOrder && window.__assignOrder('${craftsman.id}')"
              style="margin-top:8px; width:100%; padding:6px; background:#059669; color:white; border:none; border-radius:8px; font-size:11px; font-weight:600; cursor:pointer; font-family:inherit;"
            >
              تعيين طلب لهذا الحرفي
            </button>
          </div>
        `;

        marker.bindPopup(popupContent, { maxWidth: 220 });

        marker.on('click', () => {
          onCraftsmanSelect(craftsman);
        });

        marker.addTo(mapInstanceRef.current);
        markersRef.current.push(marker);
      });

      // Fit bounds if we have markers
      if (markersRef.current.length > 0) {
        const group = L.featureGroup(markersRef.current);
        mapInstanceRef.current.fitBounds(group.getBounds().pad(0.1));
      }
    });

    return () => {
      // Cleanup on unmount
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [craftsmen]);

  // Expose assign order handler to popup buttons
  useEffect(() => {
    (window as any).__assignOrder = onAssignOrder;
    return () => {
      delete (window as any).__assignOrder;
    };
  }, [onAssignOrder]);

  return (
    <>
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"
      />
      <div
        ref={mapRef}
        style={{ width: '100%', height: '100%', minHeight: '400px' }}
        className="rounded-2xl"
      />
    </>
  );
}
