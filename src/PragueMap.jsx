// src/PragueMap.jsx
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import rawData from "./data/Mestske_obvody_v_hlavnim_meste_Praze_WGS84.geojson?raw";
import { useRef, useEffect, useState } from "react";
import L from "leaflet";

const districts = JSON.parse(rawData);

// Color palette
const districtColors = {
  1: "#E43F8F",
  2: "#40C463",
  3: "#80C342",
  4: "#A974B0",
  5: "#E8963D",
  6: "#588C4A",
  7: "#5BC2C0",
  8: "#E37A40",
  9: "#F1DA4E",
  10: "#8C734A",
};

export default function PragueMap({ onSubmarketSelect }) {
  const mapRef = useRef(null);
  const [selectedDistrict, setSelectedDistrict] = useState(null);

  const styleFeature = (feature) => {
    const id = Number(feature.properties.CIS_OBEC || feature.properties.id || feature.id);
    const name =
      feature.properties.naz_uzohmp ||
      feature.properties.name ||
      `Bezirk ${feature.id}`;

    const isSelected = selectedDistrict && selectedDistrict === name.replace("Praha", "Prague").trim();

    return {
      color: isSelected ? "#000" : "#333",
      weight: isSelected ? 3 : 1,
      fillColor: districtColors[id] || "#cccccc",
      fillOpacity: isSelected ? 0.8 : 0.6,
    };
  };

  const onEachFeature = (feature, layer) => {
    const name =
      feature.properties.naz_uzohmp ||
      feature.properties.name ||
      `Bezirk ${feature.id}`;

    layer.bindTooltip(name);

    layer.on({
      mouseover: (e) => {
        e.target.setStyle({ weight: 3, fillOpacity: 0.8 });
        e.target.bringToFront();
      },
      mouseout: (e) => {
        if (selectedDistrict !== name.replace("Praha", "Prague").trim()) {
          e.target.setStyle({ weight: 1, fillOpacity: 0.6 });
        }
      },
      click: () => {
        const normalizedName = name.replace("Praha", "Prague").trim();
        setSelectedDistrict(normalizedName);
        if (onSubmarketSelect) onSubmarketSelect(normalizedName);
      },
    });
  };

  useEffect(() => {
    if (mapRef.current) {
      const map = mapRef.current;
      const layer = L.geoJSON(districts);
      map.fitBounds(layer.getBounds());
    }
  }, []);

  return (
    <MapContainer
      ref={mapRef}
      center={[50.08, 14.43]}
      zoom={12}
      style={{ height: "600px", width: "100%" }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
      />
      <GeoJSON
        key={selectedDistrict}
        data={districts}
        style={styleFeature}
        onEachFeature={onEachFeature}
      />
    </MapContainer>
  );
}
