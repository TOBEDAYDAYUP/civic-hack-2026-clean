'use client';

import { useEffect, useRef, useState } from 'react';
import type { MapEntry } from '@/lib/map-regions.mjs';
import type { Viewport } from '@/lib/map-viewport.mjs';
import { MAP_REGIONS } from '@/lib/map-regions.mjs';

type Coordinate = [number, number];
type LeafletBounds = {
  getNorth(): number;
  getSouth(): number;
  getWest(): number;
  getEast(): number;
};
type LeafletMap = {
  setView(point: Coordinate, zoom: number): LeafletMap;
  flyTo(point: Coordinate, zoom: number): void;
  getZoom(): number;
  getBounds(): LeafletBounds;
  on(name: string, handler: () => void): void;
  off(name: string, handler: () => void): void;
  remove(): void;
  invalidateSize(): void;
};
type LeafletMarker = {
  bindPopup(html: string, opts?: { maxWidth?: number }): LeafletMarker;
  openPopup(): void;
  on(name: string, handler: () => void): LeafletMarker;
};
type LeafletLayer = {
  addTo(map: LeafletMap): LeafletLayer;
  clearLayers(): void;
  addLayer(marker: LeafletMarker): void;
};
type LeafletCluster = LeafletLayer & {
  zoomToShowLayer(marker: LeafletMarker, callback: () => void): void;
};
type ClusterInfo = { getChildCount(): number };
type Leaflet = {
  map(
    element: HTMLElement,
    options: { zoomControl: boolean; scrollWheelZoom: boolean },
  ): LeafletMap;
  tileLayer(
    template: string,
    options: { attribution: string; maxZoom: number; minZoom: number },
  ): { addTo(map: LeafletMap): void };
  layerGroup(): LeafletLayer;
  markerClusterGroup(options: {
    showCoverageOnHover: boolean;
    spiderfyOnMaxZoom: boolean;
    zoomToBoundsOnClick: boolean;
    maxClusterRadius: (zoom: number) => number;
    iconCreateFunction: (cluster: ClusterInfo) => unknown;
  }): LeafletCluster;
  divIcon(options: {
    className: string;
    html: string;
    iconSize: Coordinate;
    iconAnchor: Coordinate;
  }): unknown;
  marker(coords: Coordinate, options: { icon: unknown }): LeafletMarker;
};
declare global {
  interface Window {
    L?: Leaflet;
  }
}

let mapLibraries: Promise<Leaflet> | null = null;
function addStylesheet(url: string, id: string) {
  if (document.querySelector(`link[data-civic-style="${id}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = url;
  link.dataset.civicStyle = id;
  document.head.appendChild(link);
}
function addScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Could not load map library from ${src}`));
    document.head.appendChild(script);
  });
}
function loadLeafletCluster(): Promise<Leaflet> {
  if (typeof window === 'undefined') return Promise.reject(new Error('A browser is required'));
  if (window.L?.markerClusterGroup) return Promise.resolve(window.L);
  if (mapLibraries) return mapLibraries;
  mapLibraries = (async () => {
    addStylesheet('https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css', 'leaflet');
    addStylesheet(
      'https://cdn.jsdelivr.net/npm/leaflet.markercluster@1.5.3/dist/MarkerCluster.css',
      'cluster',
    );
    addStylesheet(
      'https://cdn.jsdelivr.net/npm/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css',
      'cluster-default',
    );
    if (!window.L) await addScript('https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js');
    if (!window.L?.markerClusterGroup)
      await addScript(
        'https://cdn.jsdelivr.net/npm/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js',
      );
    if (!window.L?.markerClusterGroup)
      throw new Error('Marker clustering could not be initialized');
    return window.L;
  })().catch((error) => {
    mapLibraries = null;
    throw error;
  });
  return mapLibraries;
}

function html(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] || ch,
  );
}
function popupContent(points: MapEntry[], approximate: boolean): string {
  const seen = new Set<string>();
  const unique = points.filter((point) => !seen.has(point.id) && (seen.add(point.id), true));
  const title = approximate
    ? '<strong class="civic-popup-warning">Approximate area · not a street address</strong>'
    : `<strong>${unique.length > 1 ? `${unique.length} notices at this location` : unique[0]?.precision === 'geocoded' ? 'Geocoded street address' : 'Official notice'}</strong>`;
  const items = unique
    .slice(0, 25)
    .map((point) => {
      const name = html(
        (
          point.notice.displayTitle ||
          point.notice.simple?.plainTitle ||
          point.notice.title ||
          'Untitled notice'
        ).slice(0, 130),
      );
      const date = html(point.notice.noticeDate?.slice(0, 10) || 'Date not provided');
      const href = `/notices/${encodeURIComponent(point.id)}`;
      return `<li><a href="${href}">${name}</a><small>${date} · ${html(point.location)}</small></li>`;
    })
    .join('');
  const extra =
    unique.length > 25
      ? `<p>Showing 25 of ${unique.length} notices. Use the list to see more.</p>`
      : '';
  const source = approximate
    ? 'Only a broad district is known. This pin is NOT the event address.'
    : unique.some((p) => p.precision === 'geocoded')
      ? 'Street address matched by Geoapify; verify the original notice for exact location.'
      : 'Coordinates supplied in the official notice.';
  return `<div class="civic-marker-popup">${title}<ul>${items}</ul>${extra}<p class="civic-popup-footer">${source}</p></div>`;
}

export default function InteractiveMap({
  entries,
  region,
  selectedId,
  focusSelection,
  onViewportChange,
  onSelectNotice,
}: {
  entries: MapEntry[];
  region: string;
  selectedId: string | null;
  focusSelection: boolean;
  onViewportChange: (value: Viewport) => void;
  onSelectNotice: (id: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const leaflet = useRef<Leaflet | null>(null);
  const cluster = useRef<LeafletCluster | null>(null);
  const approxLayer = useRef<LeafletLayer | null>(null);
  const markers = useRef<Map<string, LeafletMarker>>(new Map());
  const selectedHandler = useRef(onSelectNotice);
  const viewportHandler = useRef(onViewportChange);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    selectedHandler.current = onSelectNotice;
    viewportHandler.current = onViewportChange;
  }, [onSelectNotice, onViewportChange]);

  useEffect(() => {
    let disposed = false;
    let ownMap: LeafletMap | null = null;
    let observer: ResizeObserver | undefined;
    void loadLeafletCluster()
      .then((L) => {
        if (disposed || !container.current) return;
        leaflet.current = L;
        ownMap = L.map(container.current, { zoomControl: true, scrollWheelZoom: true }).setView(
          [43.727, -79.39],
          10,
        );
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>',
          maxZoom: 19,
          minZoom: 9,
        }).addTo(ownMap);
        cluster.current = L.markerClusterGroup({
          showCoverageOnHover: false,
          spiderfyOnMaxZoom: true,
          zoomToBoundsOnClick: true,
          maxClusterRadius: (zoom) => (zoom >= 16 ? 28 : zoom >= 13 ? 43 : 62),
          iconCreateFunction: (group) => {
            const number = group.getChildCount();
            return L.divIcon({
              className: 'civic-pin-wrapper',
              html: `<div class="civic-dynamic-cluster" aria-label="${number} municipal notices"><span>${number}</span></div>`,
              iconSize: [49, 49],
              iconAnchor: [24, 24],
            });
          },
        }).addTo(ownMap) as LeafletCluster;
        approxLayer.current = L.layerGroup().addTo(ownMap);
        map.current = ownMap;
        const publish = () => {
          if (!map.current) return;
          const bounds = map.current.getBounds();
          viewportHandler.current({
            north: bounds.getNorth(),
            south: bounds.getSouth(),
            west: bounds.getWest(),
            east: bounds.getEast(),
            zoom: map.current.getZoom(),
          });
        };
        ownMap.on('moveend', publish);
        ownMap.on('zoomend', publish);
        publish();
        observer = new ResizeObserver(() => {
          if (!disposed) {
            ownMap?.invalidateSize();
            publish();
          }
        });
        observer.observe(container.current);
        setReady(true);
        window.setTimeout(() => {
          if (!disposed) {
            ownMap?.invalidateSize();
            publish();
          }
        }, 120);
      })
      .catch((e) => {
        if (!disposed) setError(e instanceof Error ? e.message : 'Map unavailable');
      });
    return () => {
      disposed = true;
      observer?.disconnect();
      ownMap?.remove();
      map.current = null;
      leaflet.current = null;
      cluster.current = null;
      approxLayer.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready || !map.current) return;
    if (region === 'all') map.current.flyTo([43.727, -79.39], 10);
    else {
      const area = MAP_REGIONS.find((item) => item.id === region);
      if (area) map.current.flyTo(area.center as Coordinate, area.zoom);
    }
  }, [ready, region]);

  useEffect(() => {
    if (!ready || !map.current || !leaflet.current || !cluster.current || !approxLayer.current)
      return;
    const L = leaflet.current;
    cluster.current.clearLayers();
    approxLayer.current.clearLayers();
    markers.current.clear();
    const byApprox = new Map<string, MapEntry[]>();
    for (const point of entries) {
      if (point.approximate) {
        const list = byApprox.get(point.region) || [];
        list.push(point);
        byApprox.set(point.region, list);
        continue;
      }
      const style = point.precision === 'geocoded' ? 'civic-pin-geocoded' : 'civic-pin-exact';
      const marker = L.marker([point.latitude, point.longitude], {
        icon: L.divIcon({
          className: 'civic-pin-wrapper',
          html: `<div class="civic-pin ${style}" aria-label="Notice at ${html(point.location)}"><span class="civic-pin-dot"></span></div>`,
          iconSize: [39, 39],
          iconAnchor: [19, 19],
        }),
      }).bindPopup(popupContent([point], false), { maxWidth: 320 });
      marker.on('click', () => selectedHandler.current(point.id));
      cluster.current.addLayer(marker);
      if (!markers.current.has(point.id)) markers.current.set(point.id, marker);
    }
    for (const group of byApprox.values()) {
      const point = group[0];
      const uniqueCount = new Set(group.map((p) => p.id)).size;
      const inner =
        uniqueCount > 1
          ? `<span class="civic-pin-count">${uniqueCount}</span>`
          : '<span class="civic-pin-dot"></span>';
      const marker = L.marker([point.latitude, point.longitude], {
        icon: L.divIcon({
          className: 'civic-pin-wrapper',
          html: `<div class="civic-pin civic-pin-approx" aria-label="Approximate region for ${uniqueCount} notices">${inner}</div>`,
          iconSize: [39, 39],
          iconAnchor: [19, 19],
        }),
      }).bindPopup(popupContent(group, true), { maxWidth: 330 });
      if (uniqueCount === 1) marker.on('click', () => selectedHandler.current(point.id));
      approxLayer.current.addLayer(marker);
      for (const p of group) if (!markers.current.has(p.id)) markers.current.set(p.id, marker);
    }
  }, [ready, entries]);

  useEffect(() => {
    if (!ready || !focusSelection || !selectedId || !map.current) return;
    const point = entries.find((p) => p.id === selectedId);
    const marker = markers.current.get(selectedId);
    if (!point || !marker) return;
    const instance = map.current;
    const targetZoom = point.approximate
      ? Math.max(11, instance.getZoom())
      : Math.max(16, instance.getZoom());
    instance.flyTo([point.latitude, point.longitude], targetZoom);
    const timeout = window.setTimeout(() => {
      if (!map.current || !marker) return;
      if (point.approximate) marker.openPopup();
      else cluster.current?.zoomToShowLayer(marker, () => marker.openPopup());
    }, 650);
    return () => window.clearTimeout(timeout);
  }, [ready, selectedId, focusSelection, entries]);

  return (
    <div className="civic-map-frame">
      <div
        ref={container}
        className="civic-map-canvas"
        role="application"
        aria-label="Interactive Toronto municipal notice map; zoom to separate nearby pins"
      />
      {!ready && !error && (
        <div className="civic-map-loading" role="status">
          Loading Toronto map and clustering…
        </div>
      )}
      {error && (
        <div className="civic-map-loading civic-map-error" role="alert">
          {error}
          <p>The notice list remains available.</p>
        </div>
      )}
      <div className="civic-map-legend">
        <span>
          <i className="civic-legend-exact" /> Source coordinate
        </span>
        <span>
          <i className="civic-legend-geocoded" /> Matched street
        </span>
        <span>
          <i className="civic-legend-approx" /> Approximate area
        </span>
      </div>
    </div>
  );
}
