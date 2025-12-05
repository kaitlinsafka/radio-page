import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { RadioStation } from '@/services/radioBrowserApi';
import { Button } from '@/components/ui/button';
import { Play } from 'lucide-react';

// Fix for default marker icon in React
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

L.Marker.prototype.options.icon = DefaultIcon;

interface StationMapProps {
  stations: RadioStation[];
  onStationClick: (station: RadioStation) => void;
}

// Component to update map view when stations change
const MapUpdater = ({ stations }: { stations: RadioStation[] }) => {
  const map = useMap();

  useEffect(() => {
    if (stations.length > 0) {
      const bounds = L.latLngBounds(stations.map(s => [s.geo_lat!, s.geo_long!]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 10 });
    }
  }, [stations, map]);

  return null;
};

const StationMap = ({ stations, onStationClick }: StationMapProps) => {
  // Filter valid stations
  const validStations = stations.filter(s => s.geo_lat && s.geo_long);

  // Default center (world)
  const center: [number, number] = [20, 0];

  return (
    <div className="relative w-full h-[500px] rounded-lg overflow-hidden shadow-lg border border-border z-0">
      <MapContainer
        center={center}
        zoom={2}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapUpdater stations={validStations} />

        {validStations.map((station) => (
          <Marker
            key={station.stationuuid}
            position={[station.geo_lat!, station.geo_long!]}
          >
            <Popup>
              <div className="p-1 min-w-[150px]">
                <h3 className="font-bold text-sm mb-1">{station.name}</h3>
                <p className="text-xs text-muted-foreground mb-2">{station.country}</p>
                <Button
                  size="sm"
                  className="w-full h-7 text-xs"
                  onClick={() => onStationClick(station)}
                >
                  <Play className="w-3 h-3 mr-1" /> Play
                </Button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default StationMap;
