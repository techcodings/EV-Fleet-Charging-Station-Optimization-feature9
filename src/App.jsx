import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "./energyverse.css";

const API_BASE = import.meta.env.VITE_API_BASE || "https://joyful-kangaroo-2731b3.netlify.app/api";


function Map({ path, stops }) {
  const ref = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);

  useEffect(() => {
    if (!mapRef.current) {
      mapRef.current = L.map(ref.current).setView([11.1085, 77.3411], 10);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(mapRef.current);
    }

    if (layerRef.current) layerRef.current.remove();

    if (path?.length) {
      layerRef.current = L.polyline(
        path.map((p) => [p.lat, p.lon]),
        {
          weight: 6,
          color: "#CAFF3A",
          opacity: 0.95,
          className: "ev-route-glow",
        }
      ).addTo(mapRef.current);

      mapRef.current.fitBounds(layerRef.current.getBounds(), { padding: [30, 30] });
    }

    if (stops?.length) {
      stops.forEach((s) =>
        L.marker([s.lat, s.lon])
          .addTo(mapRef.current)
          .bindPopup(`<b>${s.name}</b><br>${s.energy_added_kwh.toFixed(2)} kWh`)
      );
    }
  }, [path, stops]);

  return <div className="ev-map" ref={ref}></div>;
}

export default function App() {
  const [form, setForm] = useState({
    oLat: 11.1085,
    oLon: 77.3411,
    dLat: 11.0168,
    dLon: 76.9558,
    battery_kwh: 40,
    soc_start: 0.8,
    soc_min: 0.1,
    price: 0.16,
  });

  const [result, setResult] = useState(null);
  const [sim, setSim] = useState(null);
  const [alerts, setAlerts] = useState([]);

  const plan = async () => {
    const body = {
      origin: { lat: +form.oLat, lon: +form.oLon },
      destination: { lat: +form.dLat, lon: +form.dLon },
      price_per_kwh: +form.price,
      vehicle: {
        battery_kwh: +form.battery_kwh,
        soc_start: +form.soc_start,
        soc_min: +form.soc_min,
      },
    };

    const r = await fetch(`${API_BASE}/plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setResult(await r.json());

    const s = await fetch(`${API_BASE}/simulate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSim(await s.json());

    const a = await fetch(`${API_BASE}/alerts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const aj = await a.json();
    setAlerts(aj.alerts || []);
  };

  // ✅ Auto run optimization on page load
  useEffect(() => {
    plan();
  }, []);

  return (
    <div className="ev-wrapper">
      <h1 className="ev-title">⚡ EV Route & Charging Optimizer</h1>
      <p className="ev-sub">Plan smarter EV trips with AI-powered routing & charging</p>

      <div className="ev-layout">
        {/* ✅ LEFT FORM */}
        <div className="ev-card fade-in">
          <h3 className="ev-sec-title">🛣️ Route Input</h3>

          <div className="ev-form-grid">
            {[
              ["Origin Lat", "oLat"], ["Origin Lon", "oLon"],
              ["Dest Lat", "dLat"], ["Dest Lon", "dLon"],
              ["Battery kWh", "battery_kwh"], ["Start SOC", "soc_start"],
              ["Min SOC", "soc_min"], ["$/kWh", "price"],
            ].map(([label, key]) => (
              <div className="ev-field" key={key}>
                <label>{label}</label>
                <input
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  type="number"
                  step="0.01"
                />
              </div>
            ))}
          </div>

          <button className="ev-btn neon" onClick={plan}>
            🚗 Recalculate Route
          </button>

          {alerts?.map((a, i) => (
            <div key={i} className="ev-alert neon-pulse">
              <b>{a.type.toUpperCase()}</b> — {a.message}
            </div>
          ))}
        </div>

        {/* ✅ RIGHT OUTPUT */}
        <div className="ev-right-box fade-in">
          {result && (
            <div className="ev-card slide-up">
              <h3 className="ev-sec-title">🔌 Charging Schedule</h3>

              <table className="ev-table">
                <thead>
                  <tr><th>Stop</th><th>Arrive</th><th>kWh</th><th>Mins</th><th>Cost</th></tr>
                </thead>
                <tbody>
                  {result.stops.map((s, i) => (
                    <tr key={i}>
                      <td>{s.name}</td>
                      <td>{(s.arrive_soc * 100).toFixed(0)}%</td>
                      <td>{s.energy_added_kwh.toFixed(2)}</td>
                      <td>{s.charge_minutes}</td>
                      <td>${s.cost_usd.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="ev-summary-stats">
                ⚡ {result.total_energy_kwh.toFixed(2)} kWh &nbsp;|&nbsp;
                💰 ${result.total_cost_usd.toFixed(2)} &nbsp;|&nbsp;
                🔋 {(result.final_soc * 100).toFixed(0)}%
              </div>
            </div>
          )}

          {sim && (
            <div className="ev-card slide-up">
              <h3 className="ev-sec-title">🚦 Traffic Simulation</h3>
              <p>Baseline: {sim.baseline.route.duration_min.toFixed(1)} min</p>
              <p>Traffic: {sim.heavyTraffic.route.duration_min.toFixed(1)} min</p>
            </div>
          )}
        </div>
      </div>

      {/* ✅ MAP */}
      <div className="ev-map-wrapper fade-up">
        <Map path={result?.route?.geometry} stops={result?.stops} />
      </div>
    </div>
  );
}
