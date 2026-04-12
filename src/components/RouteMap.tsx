import { MapContainer, TileLayer, Polyline, useMap } from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import { LatLngBounds } from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect } from "react";

// --------------- types ---------------

export interface GuzergahNokta {
  yon: number | null;
  sira: number;
  enlem: number | null;
  boylam: number | null;
}

interface RouteMapProps {
  guzergah: GuzergahNokta[];
  className?: string;
}

// --------------- helper components ---------------

interface FitBoundsProps {
  bounds: LatLngBounds | null;
}

function FitBounds({ bounds }: FitBoundsProps) {
  const map = useMap();

  useEffect(() => {
    if (bounds && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [20, 20] });
    }
  }, [map, bounds]);

  return null;
}

// --------------- main component ---------------

export function RouteMap({ guzergah, className = "" }: RouteMapProps) {
  // Yön 1 (Gidiş) ve Yön 2 (Dönüş) olarak ayır
  const gidisNoktalar = guzergah
    .filter((g) => g.yon === 1 && g.enlem != null && g.boylam != null)
    .sort((a, b) => a.sira - b.sira)
    .map((g) => [g.enlem!, g.boylam!] as LatLngExpression);

  const donusNoktalar = guzergah
    .filter((g) => g.yon === 2 && g.enlem != null && g.boylam != null)
    .sort((a, b) => a.sira - b.sira)
    .map((g) => [g.enlem!, g.boylam!] as LatLngExpression);

  // Tüm noktaları birleştir (bounds hesaplamak için)
  const tumNoktalar = [...gidisNoktalar, ...donusNoktalar];

  // Harita merkezi ve bounds
  const defaultCenter: LatLngExpression = [38.4192, 27.1287]; // İzmir merkez
  const bounds =
    tumNoktalar.length > 0
      ? new LatLngBounds(tumNoktalar as [number, number][])
      : null;

  if (guzergah.length === 0) {
    return (
      <div className={`flex items-center justify-center bg-slate-100 rounded-xl ${className}`}>
        <p className="text-slate-400 text-sm">Güzergah verisi yok</p>
      </div>
    );
  }

  return (
    <MapContainer
      center={defaultCenter}
      zoom={13}
      className={`rounded-xl ${className}`}
      style={{ minHeight: "400px" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />

      {/* Gidiş rotası - Yeşil */}
      {gidisNoktalar.length > 1 && (
        <Polyline
          positions={gidisNoktalar}
          pathOptions={{
            color: "#16a34a",
            weight: 4,
            opacity: 0.8,
          }}
        />
      )}

      {/* Dönüş rotası - Turuncu */}
      {donusNoktalar.length > 1 && (
        <Polyline
          positions={donusNoktalar}
          pathOptions={{
            color: "#ea580c",
            weight: 4,
            opacity: 0.8,
            dashArray: "10, 10",
          }}
        />
      )}

      <FitBounds bounds={bounds} />
    </MapContainer>
  );
}

export default RouteMap;

