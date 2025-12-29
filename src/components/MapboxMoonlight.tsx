import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { RadioStation } from '@/services/radioBrowserApi';
import { geocodeStation } from '@/services/geocoding';

// Use dynamic token from environment variables or fallback to public token
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || 'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4M29iazA2Z2gycXA4N2pmbDg5Z3IifQ.nSBy9y7pcn9bHjQJ9PToBg';

interface MapboxMoonlightProps {
    stations: RadioStation[];
    onStationClick: (station: RadioStation) => void;
    onRegionSelect: (countryCode: string, stateName?: string) => void;
    onReset: () => void;
    isDarkMode: boolean;
}

const WORLD_GEOJSON = 'https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_110m_admin_0_countries.geojson';
const US_STATES_GEOJSON = 'https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_110m_admin_1_states_provinces_shp.geojson';

export const MapboxMoonlight: React.FC<MapboxMoonlightProps> = ({
    stations,
    onStationClick,
    onRegionSelect,
    onReset,
    isDarkMode
}) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<mapboxgl.Map | null>(null);
    const markersRef = useRef<mapboxgl.Marker[]>([]);
    const activePopupRef = useRef<mapboxgl.Popup | null>(null);
    const [view, setView] = useState<'world' | 'us'>('world');

    // Initialize Map
    useEffect(() => {
        if (!mapContainerRef.current) return;

        const map = new mapboxgl.Map({
            container: mapContainerRef.current,
            style: 'mapbox://styles/kaitlin-safka/cmjd4dcgd004101s83ta4ghmo',
            center: [0, 20],
            zoom: 1.5,
            projection: 'globe' as any,
            attributionControl: false
        });

        map.addControl(new mapboxgl.NavigationControl(), 'top-right');
        mapRef.current = map;

        const setupLayers = () => {
            if (!map.getSource('world')) {
                map.addSource('world', { type: 'geojson', data: WORLD_GEOJSON });
            }

            // Country Interaction Layer (Transparent Fills)
            if (!map.getLayer('country-fills')) {
                map.addLayer({
                    id: 'country-fills',
                    type: 'fill',
                    source: 'world',
                    paint: { 'fill-color': 'rgba(0,0,0,0)', 'fill-opacity': 0 }
                });
            }

            // Hover Effect Layer
            if (!map.getLayer('country-hover')) {
                map.addLayer({
                    id: 'country-hover',
                    type: 'fill',
                    source: 'world',
                    paint: { 'fill-color': '#4a90e2', 'fill-opacity': 0.2 },
                    filter: ['==', 'iso_a2', '']
                });
            }
        };

        map.on('style.load', setupLayers);

        // Hover Countries
        map.on('mousemove', 'country-fills', (e) => {
            if (e.features && e.features.length > 0) {
                const iso = e.features[0].properties?.iso_a2;
                map.setFilter('country-hover', ['==', 'iso_a2', iso]);
                map.getCanvas().style.cursor = 'pointer';
            }
        });

        map.on('mouseleave', 'country-fills', () => {
            map.setFilter('country-hover', ['==', 'iso_a2', '']);
            map.getCanvas().style.cursor = '';
        });

        // Click Countries
        map.on('click', 'country-fills', (e) => {
            if (e.features && e.features.length > 0) {
                const iso = e.features[0].properties?.iso_a2;
                if (iso === 'US') {
                    handleUSDrillDown(map);
                } else if (iso) {
                    map.flyTo({ center: e.lngLat, zoom: 6, duration: 2000, essential: true });
                    onRegionSelect(iso);
                }
            }
        });

        // Zoom Logic: Auto Reset
        // Zoom Logic: Auto Reset & Cleanup
        map.on('zoom', () => { // Changed to 'zoom' for smoother realtime updates, or stick to zoomend? 'zoom' is better for "immediate" feel.
            const z = map.getZoom();
            if (z < 4.5 && activePopupRef.current) {
                activePopupRef.current.remove();
                activePopupRef.current = null;
            }
        });

        map.on('zoomend', () => {
            const z = map.getZoom();
            // User requested: "If zoom < 4, pins disappear and search reset"
            if (z < 3.5) {
                onReset(); // Clear parent state
                if (view === 'us') handleReset(map); // Reset map layers
            }
        });

        return () => {
            map.remove();
        };
    }, []);

    const handleUSDrillDown = (map: mapboxgl.Map) => {
        setView('us');
        map.flyTo({ center: [-98.5795, 39.8283], zoom: 4.5, duration: 2000 });

        if (!map.getSource('us-states')) {
            map.addSource('us-states', { type: 'geojson', data: US_STATES_GEOJSON });
        }

        if (!map.getLayer('state-fills')) {
            map.addLayer({
                id: 'state-fills',
                type: 'fill',
                source: 'us-states',
                paint: { 'fill-color': 'rgba(0,0,0,0)', 'fill-opacity': 0 }
            });

            map.addLayer({
                id: 'state-hover',
                type: 'fill',
                source: 'us-states',
                paint: { 'fill-color': '#4a90e2', 'fill-opacity': 0.2 },
                filter: ['==', 'name', '']
            });

            map.on('mousemove', 'state-fills', (e) => {
                if (e.features && e.features.length > 0) {
                    map.setFilter('state-hover', ['==', 'name', e.features[0].properties?.name]);
                }
            });

            map.on('mouseleave', 'state-fills', () => {
                map.setFilter('state-hover', ['==', 'name', '']);
            });

            map.on('click', 'state-fills', (e) => {
                if (e.features && e.features.length > 0) {
                    const name = e.features[0].properties?.name;
                    map.flyTo({ center: e.lngLat, zoom: 6, duration: 1500 });
                    onRegionSelect('US', name);
                }
            });
        }

        map.setLayoutProperty('country-fills', 'visibility', 'none');
        map.setLayoutProperty('state-fills', 'visibility', 'visible');
    };

    const handleReset = (map: mapboxgl.Map) => {
        setView('world');
        if (map.getLayer('country-fills')) map.setLayoutProperty('country-fills', 'visibility', 'visible');
        if (map.getLayer('state-fills')) map.setLayoutProperty('state-fills', 'visibility', 'none');
    };

    // Update Pins
    useEffect(() => {
        if (!mapRef.current) return;
        const map = mapRef.current;



        // Clear existing
        markersRef.current.forEach(m => m.remove());
        markersRef.current = [];

        // Async Geocoding Helper
        const processStation = async (station: RadioStation) => {
            let coords: [number, number] | null = null;

            if (station.geo_lat && station.geo_long) {
                coords = [station.geo_long, station.geo_lat];
            } else {
                // Fallback (simplified for speed)
                const cached = geocodeStation(station);
                if (cached) coords = [cached.lng, cached.lat];
            }

            if (coords) {
                // Create custom Pin Element
                const el = document.createElement('div');
                el.className = 'custom-pin-marker';
                el.style.width = '24px';
                el.style.height = '24px';
                el.style.backgroundImage = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ef4444' stroke='%23ffffff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z'%3E%3C/path%3E%3Ccircle cx='12' cy='10' r='3'%3E%3C/circle%3E%3C/svg%3E")`;
                el.style.backgroundSize = 'cover';
                el.style.cursor = 'pointer';
                el.style.filter = 'drop-shadow(0px 2px 4px rgba(0,0,0,0.5))';
                el.style.transform = 'translateY(-50%)'; // Anchor bottom center? standard transform centers it. Pin tip is bottom.
                // Mapbox centers the element on the coord. We need to shift it up so the tip is on the coord.
                // But marker offset handles this better.

                const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
                    .setLngLat(coords)
                    .addTo(map);

                // Interaction Logic: Hover (Small) & Sticky (Click)
                let hoverPopup: mapboxgl.Popup | null = null;

                el.addEventListener('mouseenter', () => {
                    if (activePopupRef.current) return;
                    hoverPopup = new mapboxgl.Popup({
                        offset: 25,
                        closeButton: false,
                        closeOnClick: false,
                        className: 'hover-popup'
                    })
                        .setHTML(`<div style="padding: 4px 8px; font-weight: bold; font-family: sans-serif; font-size: 12px; color: #333;">${station.name}</div>`)
                        .setLngLat(coords)
                        .addTo(map);
                });

                el.addEventListener('mouseleave', () => {
                    if (hoverPopup) {
                        hoverPopup.remove();
                        hoverPopup = null;
                    }
                });

                el.addEventListener('click', (e) => {
                    e.stopPropagation();

                    // Clear hover popup on click
                    if (hoverPopup) {
                        hoverPopup.remove();
                        hoverPopup = null;
                    }

                    // 1. Close existing sticky popup
                    if (activePopupRef.current) {
                        activePopupRef.current.remove();
                        activePopupRef.current = null;
                    }

                    // 2. Create new Sticky Popup
                    const popup = new mapboxgl.Popup({
                        offset: 25,
                        closeButton: false, // Custom Close Button will be used
                        closeOnClick: false,
                        maxWidth: '300px',
                        className: 'sticky-popup'
                    });

                    popup.setHTML(`
                        <div style="padding: 12px; font-family: sans-serif; min-width: 220px; position: relative;">
                            <button id="close-btn-${station.stationuuid}" style="position: absolute; top: -5px; right: -5px; background: none; border: none; font-size: 20px; font-weight: bold; color: #666; cursor: pointer; padding: 4px; line-height: 1;">
                                &times;
                            </button>
                            <h3 style="margin: 0 0 4px; font-weight: 800; font-size: 16px; color: #111; padding-right: 20px;">${station.name}</h3>
                            <p style="margin: 0 0 12px; font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px;">
                                ${station.country}
                            </p>
                            <button id="play-btn-${station.stationuuid}" 
                                style="width: 100%; padding: 8px; background: #222; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; transition: background 0.2s;">
                                PLAY STATION
                            </button>
                        </div>
                    `);

                    marker.setPopup(popup);
                    popup.addTo(map);
                    activePopupRef.current = popup;

                    // 3. Bind Events
                    requestAnimationFrame(() => {
                        const playBtn = document.getElementById(`play-btn-${station.stationuuid}`);
                        const closeBtn = document.getElementById(`close-btn-${station.stationuuid}`);

                        if (playBtn) {
                            playBtn.onclick = (ev) => {
                                ev.stopPropagation();
                                onStationClick(station);
                            };
                            playBtn.onmouseenter = () => { playBtn.style.backgroundColor = '#444'; };
                            playBtn.onmouseleave = () => { playBtn.style.backgroundColor = '#222'; };
                        }

                        if (closeBtn) {
                            closeBtn.onclick = (ev) => {
                                ev.stopPropagation();
                                popup.remove();
                            };
                        }
                    });

                    // Cleanup Ref on Close
                    popup.on('close', () => {
                        if (activePopupRef.current === popup) {
                            activePopupRef.current = null;
                        }
                    });
                });



                markersRef.current.push(marker);
            }
        };

        stations.forEach(processStation);



    }, [stations]);

    return (
        <div className="relative w-full h-[600px] rounded-2xl overflow-hidden border-2 border-[#331F21] dark:border-white/10 shadow-2xl">
            <div ref={mapContainerRef} className="w-full h-full bg-black" />
            <div className="absolute top-4 left-4 bg-black/80 backdrop-blur px-4 py-2 rounded-full text-[10px] font-bold text-white tracking-widest uppercase">
                {view === 'us' ? 'US VIEW (Zoom Out to Reset)' : 'WORLD VIEW'}
            </div>
        </div>
    );
};
