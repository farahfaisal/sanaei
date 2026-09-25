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
        const bgColor = isOnline ? '#059669' : '#6b7280';
        const borderColor = isOnline ? '#34d399' : '#9ca3af';

        // Worker/craftsman SVG icon with hard hat
        const svgIcon = `
          <svg xmlns="http://www.w3.org/2000/svg" width="44" height="54" viewBox="0 0 44 54">
            <!-- Pin shape -->
            <path d="M22 0C10.954 0 2 8.954 2 20c0 13 20 34 20 34s20-21 20-34C42 8.954 33.046 0 22 0z" fill="${bgColor}" stroke="${borderColor}" stroke-width="2"/>
            <!-- White circle background -->
            <circle cx="22" cy="19" r="13" fill="white"/>
            <!-- Worker body (torso) -->
            <rect x="15" y="25" width="14" height="8" rx="3" fill="${bgColor}"/>
            <!-- Worker head -->
            <circle cx="22" cy="20" r="5" fill="${bgColor}"/>
            <!-- Hard hat brim -->
            <rect x="13" y="15" width="18" height="3" rx="1.5" fill="${bgColor}"/>
            <!-- Hard hat dome -->
            <path d="M16 15 Q22 9 28 15" fill="${bgColor}" stroke="${bgColor}" stroke-width="1"/>
            <!-- Online indicator dot -->
            <circle cx="33" cy="9" r="4" fill="${isOnline ? '#22c55e' : '#9ca3af'}" stroke="white" stroke-width="1.5"/>
          </svg>
        `;

        const icon = L.divIcon({
          html: svgIcon,
          className: '',
          iconSize: [44, 54],
          iconAnchor: [22, 54],
          popupAnchor: [0, -54],
        });

        const marker = L.marker([craftsman.lat!, craftsman.lng!], { icon });

        const popupContent = `
          <div style="font-family: 'Cairo', sans-serif; direction: rtl; min-width: 180px; padding: 4px;">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
              <div style="width:8px; height:8px; border-radius:50%; background:${bgColor}; flex-shrink:0;"></div>
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
