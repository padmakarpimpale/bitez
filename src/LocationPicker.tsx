import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Location } from "./types";
import { inSingapore } from "./utils";
export function LocationPicker({
  value,
  onChange,
}: {
  value: Location;
  onChange: (v: Location) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map>();
  const marker = useRef<L.Marker>();
  const change = useRef(onChange);
  change.current = onChange;
  useEffect(() => {
    if (!root.current) return;
    const m = L.map(root.current, {
      center: [value.lat, value.lng],
      zoom: 16,
      maxBounds: [
        [1.15, 103.6],
        [1.5, 104.1],
      ],
      minZoom: 11,
    });
    map.current = m;
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(m);
    const pin = L.divIcon({
      className: "pickup-pin",
      html: "<span></span>",
      iconSize: [28, 28],
      iconAnchor: [14, 28],
    });
    marker.current = L.marker([value.lat, value.lng], {
      icon: pin,
      draggable: true,
    }).addTo(m);
    const select = (lat: number, lng: number) => {
      if (inSingapore(lat, lng))
        change.current({ lat, lng, label: "Selected pickup point" });
    };
    m.on("click", (e) => select(e.latlng.lat, e.latlng.lng));
    marker.current.on("dragend", () => {
      const p = marker.current!.getLatLng();
      select(p.lat, p.lng);
    });
    return () => {
      m.remove();
      map.current = undefined;
      marker.current = undefined;
    };
  }, []);
  useEffect(() => {
    marker.current?.setLatLng([value.lat, value.lng]);
    map.current?.setView([value.lat, value.lng]);
  }, [value.lat, value.lng]);
  return (
    <div
      ref={root}
      className="map"
      aria-label="Pickup map. Tap to set the point, or enter coordinates below."
    />
  );
}
