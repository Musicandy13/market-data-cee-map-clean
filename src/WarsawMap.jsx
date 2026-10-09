import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import rawData from "./data/warsaw_submarkets.geojson?raw";
import { useEffect, useRef, useState } from "react";
import L from "leaflet";

const submarkets = JSON.parse(rawData);

export default function WarsawMap({ onSubmarketSelect }) {
  const mapRef = useRef(null);
  const [selectedSubmarket, setSelectedSubmarket] = useState(null);
  const styleFeature = (feature) => {
    const isSelected = selectedSubmarket === feature.properties.name;
    return { color: isSelected ? "#111" : "#555", weight: isSelected ? 3 : 1, fillColor: feature.properties.color, fillOpacity: isSelected ? 0.82 : 0.64 };
  };
  const onEachFeature = (feature, layer) => {
    const { name } = feature.properties;
    layer.bindTooltip(name);
    layer.on({
      mouseover: (event) => event.target.setStyle({ weight: 3, fillOpacity: 0.82 }),
      mouseout: (event) => { if (selectedSubmarket !== name) event.target.setStyle({ weight: 1, fillOpacity: 0.64 }); },
      click: () => { setSelectedSubmarket(name); onSubmarketSelect?.(name); },
    });
  };
  useEffect(() => { if (mapRef.current) mapRef.current.fitBounds(L.geoJSON(submarkets).getBounds(), { padding: [18, 18] }); }, []);
  return (
    <MapContainer ref={mapRef} center={[52.2297, 21.0122]} zoom={12} style={{ height: "600px", width: "100%" }}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' />
      <GeoJSON key={selectedSubmarket} data={submarkets} style={styleFeature} onEachFeature={onEachFeature} />
    </MapContainer>
  );
}
