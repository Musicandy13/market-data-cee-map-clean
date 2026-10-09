// src/DataExplorer.jsx
import React, { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  LabelList,
} from "recharts";
import "./App.css";
import PragueMap from "./PragueMap";
import BucharestMap from "./BucharestMap";
import WarsawMap from "./WarsawMap";


/* ===== Helpers ===== */
function fmtNumber(n) {
  if (n === null || n === undefined || n === "" || Number.isNaN(n)) return "–";
  const v = Number(n);
  if (Math.abs(v) >= 1000) return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function fmtMoney(n) {
  if (n === null || n === undefined || n === "" || Number.isNaN(n)) return "–";
  const v = Number(n);
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPercent(n) {
  if (n === null || n === undefined || n === "" || Number.isNaN(n)) return "–";
  const v = Number(n);
  if (Math.abs(v) <= 1) return (v * 100).toFixed(2) + "%";
  return v.toFixed(2) + "%";
}

function coerceNumber(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return v;
  let s = String(v).trim();
  if (s === "" || s === "–") return null;
  s = s.replace(/[€%\s]/g, "");
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else if (s.includes(",")) s = s.replace(",", ".");
  const num = parseFloat(s);
  return Number.isNaN(num) ? null : num;
}

function formatMaybeRange(v, kind = "number") {
  if (v === null || v === undefined || v === "") return "–";
  if (typeof v === "number") return kind === "money" ? fmtMoney(v) : fmtNumber(v);

  let s = String(v).trim();
  s = s.replace(/€/g, "");
  const parts = s.split(/\s*(?:-|–|to)\s*/i);

  if (parts.length >= 2) {
    const a = coerceNumber(parts[0]);
    const b = coerceNumber(parts[1]);
    if (a !== null && b !== null) {
      const fa = kind === "money" ? fmtMoney(a) : fmtNumber(a);
      const fb = kind === "money" ? fmtMoney(b) : fmtNumber(b);
      return `${fa} – ${fb}`;
    }
  }

  const n = coerceNumber(s);
  if (n !== null) return kind === "money" ? fmtMoney(n) : fmtNumber(n);
  return "–";
}

function Row({ label, value }) {
  return (
    <div className="row">
      <div className="row-label">{label}</div>
      <div className="row-value">{value}</div>
    </div>
  );
}

/* ===== Build historical series ===== */
function buildTrendSeries(raw, country, city, submarket, metric) {
  const cityNode = raw?.countries?.[country]?.cities?.[city];
  if (!cityNode?.periods) return [];
  const periods = Object.keys(cityNode.periods);

  const sortPeriods = (a, b) => {
    const [qa, ya] = a.split(" ");
    const [qb, yb] = b.split(" ");
    if (ya !== yb) return Number(ya) - Number(yb);
    return Number(qa.replace("Q", "")) - Number(qb.replace("Q", ""));
  };

  const out = [];
  for (const p of periods.sort(sortPeriods)) {
    const cityData = cityNode.periods?.[p];
    if (!cityData) continue;

    const subMarketData = cityData?.subMarkets?.[submarket] || {};
    const marketData = cityData?.market || {};
    const leasingSub = cityData?.subMarkets?.[submarket]?.leasing || {};
    const leasingCity = cityData?.leasing || {};

    const merged = { ...marketData, ...leasingCity, ...subMarketData, ...leasingSub };
    let val = coerceNumber(merged?.[metric]);
    if (val === null) continue;

    if (metric === "vacancyRate" || metric === "primeYield") {
      val = Math.abs(val) <= 1 ? val * 100 : val;
    }
    out.push({ period: p, value: val });
  }
  return out;
}

const SingleTooltip = ({ active, payload, label, metric }) => {
  if (!active || !payload || !payload.length) return null;
  const val = payload[0]?.value;
  let text;
  if (metric === "vacancyRate" || metric === "primeYield") text = fmtPercent(val);
  else if (
    metric === "primeRentEurSqmMonth" ||
    metric === "averageRentEurSqmMonth" ||
    metric === "serviceChargeEurSqmMonth"
  )
    text = fmtMoney(val);
  else text = fmtNumber(val);

  return (
    <div style={{ background: "white", border: "1px solid #ccc", padding: "4px 8px", fontSize: "12px" }}>
      <strong>{label}</strong>
      <div>{text}</div>
    </div>
  );
};

function BarTrendChart({ data, metric }) {
  if (!data || data.length === 0) return <div style={{ marginTop: 10 }}>No data for this metric.</div>;

  const formatValue = (v) => {
    if (metric === "vacancyRate" || metric === "primeYield") return fmtPercent(v);
    if (
      metric === "primeRentEurSqmMonth" ||
      metric === "averageRentEurSqmMonth" ||
      metric === "serviceChargeEurSqmMonth"
    )
      return fmtMoney(v);
    return fmtNumber(v);
  };

  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
        <XAxis dataKey="period" />
        <YAxis />
        <Tooltip content={<SingleTooltip metric={metric} />} />
        <Line type="monotone" dataKey="value" stroke="#999" strokeDasharray="4 4" dot={{ r: 3, fill: "#666" }} />
        <Bar dataKey="value" fill="#003366" radius={[4, 4, 0, 0]}>
          <LabelList
            dataKey="value"
            position="top"
            formatter={(v) => formatValue(v)}
            style={{ fill: "#003366", fontSize: "12px" }}
          />
        </Bar>
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function ComparisonBlock({ raw, baseCountry, baseCity, baseSubmarket }) {
  const [country2, setCountry2] = useState("");
  const [city2, setCity2] = useState("");
  const [submarket2, setSubmarket2] = useState("");
  const [metric, setMetric] = useState("primeRentEurSqmMonth");

  useEffect(() => {
    if (!raw?.countries) return;
    const cList = Object.keys(raw.countries);
    if (!cList.length) return;

    const firstC = cList[0];
    const cities = Object.keys(raw.countries[firstC]?.cities || {});
    const firstCity = cities[0] || "";
    const periods = Object.keys(raw.countries[firstC]?.cities?.[firstCity]?.periods || {});
    const firstPeriod = periods[periods.length - 1] || "";
    const subs =
      (firstPeriod &&
        Object.keys(
          raw.countries[firstC]?.cities?.[firstCity]?.periods?.[firstPeriod]?.subMarkets || {}
        )) ||
      [];

    setCountry2((prev) => prev || firstC);
    setCity2((prev) => prev || firstCity);
    setSubmarket2((prev) => prev || subs[0] || "");
  }, [raw]);

  useEffect(() => {
    if (!country2) return;
    const cities = Object.keys(raw?.countries?.[country2]?.cities || {});
    if (!cities.length) {
      setCity2("");
      setSubmarket2("");
      return;
    }
    if (!cities.includes(city2)) setCity2(cities[0]);
  }, [country2, raw]);

  useEffect(() => {
    if (!country2 || !city2) return;
    const periods = Object.keys(raw?.countries?.[country2]?.cities?.[city2]?.periods || {});
    const firstPeriod = periods[periods.length - 1] || "";
    const subs = Object.keys(
      raw?.countries?.[country2]?.cities?.[city2]?.periods?.[firstPeriod]?.subMarkets || {}
    );
    if (!subs.length) {
      if (submarket2) setSubmarket2("");
      return;
    }
    if (!subs.includes(submarket2)) setSubmarket2(subs[0]);
  }, [country2, city2, raw]);

  if (!raw?.countries) return null;

  const countries = Object.keys(raw.countries);
  const cities2 = country2 ? Object.keys(raw?.countries?.[country2]?.cities || {}) : [];
  const submarkets2 = (() => {
    const firstPeriodKey = Object.keys(raw?.countries?.[country2]?.cities?.[city2]?.periods || {})[0];
    if (!firstPeriodKey) return [];
    return Object.keys(
      raw?.countries?.[country2]?.cities?.[city2]?.periods?.[firstPeriodKey]?.subMarkets || {}
    );
  })();

  const baseData = buildTrendSeries(raw, baseCountry, baseCity, baseSubmarket, metric);
  let compData = buildTrendSeries(raw, country2, city2, submarket2, metric);
  if (compData.length === 0) compData = buildTrendSeries(raw, country2, city2, "", metric);

  const seriesNameBase = baseCity + (baseSubmarket ? " — " + baseSubmarket : "");
  const seriesNameComp = city2 + (submarket2 ? " — " + submarket2 : "");

  const allPeriods = Array.from(
    new Set([...baseData.map((d) => d.period), ...compData.map((d) => d.period)])
  ).sort((a, b) => {
    const [qa, ya] = a.split(" ");
    const [qb, yb] = b.split(" ");
    if (ya !== yb) return Number(ya) - Number(yb);
    return Number(qa.replace("Q", "")) - Number(qb.replace("Q", ""));
  });

  const merged = allPeriods.map((p) => ({
    period: p,
    base: baseData.find((d) => d.period === p)?.value ?? null,
    comp: compData.find((d) => d.period === p)?.value ?? null,
  }));

  return (
    <div className="section-box section-box--orange" style={{ marginTop: "30px" }}>
      <div className="section-header section-header--orange">Market Comparison</div>

      <div style={{ padding: "10px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "6px",
            marginBottom: "10px",
          }}
        >
          <select value={country2} onChange={(e) => setCountry2(e.target.value)}>
            {countries.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select value={city2} onChange={(e) => setCity2(e.target.value)}>
            {cities2.map((ct) => (
              <option key={ct} value={ct}>
                {ct}
              </option>
            ))}
          </select>

          {submarkets2.length > 0 && (
            <select value={submarket2} onChange={(e) => setSubmarket2(e.target.value)}>
              {submarkets2.map((sm) => (
                <option key={sm} value={sm}>
                  {sm}
                </option>
              ))}
            </select>
          )}

          <select value={metric} onChange={(e) => setMetric(e.target.value)}>
            {[
              { key: "totalStock", label: "Total Stock (sqm)" },
              { key: "vacancy", label: "Vacancy (sqm)" },
              { key: "vacancyRate", label: "Vacancy Rate (%)" },
              { key: "primeRentEurSqmMonth", label: "Prime Rent (€/sqm/month)" },
              { key: "averageRentEurSqmMonth", label: "Average Rent (€/sqm/month)" },
              { key: "primeYield", label: "Prime Yield (%)" },
              { key: "fitOutEurSqmShellCore", label: "Fit-out (€/sqm)" },
              { key: "serviceChargeEurSqmMonth", label: "Service charge (€/sqm/month)" },
            ].map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={merged} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
            <XAxis dataKey="period" />
            <YAxis />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;

                const byKey = new Map();
                for (const p of payload) {
                  if ((p?.dataKey === "base" || p?.dataKey === "comp") && p.value != null) {
                    if (!byKey.has(p.dataKey)) byKey.set(p.dataKey, p.value);
                  }
                }

                const rows = [];
                if (byKey.has("base")) rows.push({ name: seriesNameBase, val: byKey.get("base"), color: "#0b3d91" });
                if (byKey.has("comp")) rows.push({ name: seriesNameComp, val: byKey.get("comp"), color: "#7fb3ff" });

                const fmt = (v) =>
                  metric === "vacancyRate" || metric === "primeYield"
                    ? fmtPercent(v)
                    : metric === "primeRentEurSqmMonth" ||
                      metric === "averageRentEurSqmMonth" ||
                      metric === "serviceChargeEurSqmMonth"
                    ? fmtMoney(v)
                    : fmtNumber(v);

                return (
                  <div style={{ background: "white", border: "1px solid #ccc", padding: "6px 8px", fontSize: "12px" }}>
                    <strong style={{ display: "block", marginBottom: 4 }}>{label}</strong>
                    {rows.map((x) => (
                      <div key={x.name} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <span style={{ display: "inline-block", width: 10, height: 10, background: x.color }} />
                        <span style={{ minWidth: 140 }}>{x.name}:</span>
                        <span>{fmt(x.val)}</span>
                      </div>
                    ))}
                  </div>
                );
              }}
            />
            <Line type="monotone" dataKey="base" stroke="#0b3d91" dot={false} />
            <Bar dataKey="base" fill="#0b3d91" barSize={20} />
            <Line type="monotone" dataKey="comp" stroke="#e67e22" dot={false} />
            <Bar dataKey="comp" fill="#7fb3ff" barSize={20} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function DataExplorerApp() {
  const [raw, setRaw] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorLoading, setErrorLoading] = useState(null);

  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [submarket, setSubmarket] = useState("");
  const [period, setPeriod] = useState("");
  const [selectedMetric, setSelectedMetric] = useState("primeRentEurSqmMonth");

  useEffect(() => {
    setLoading(true);
    fetch(`${import.meta.env.BASE_URL}market_data.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json) => {
        setRaw(json);
        const countries = Object.keys(json?.countries || {});
        if (!countries.length) {
          setLoading(false);
          return;
        }
        const firstCountry = countries[0];
        const cities = Object.keys(json?.countries?.[firstCountry]?.cities || {});
        const firstCity = cities[0] || "";
        const periods = Object.keys(json?.countries?.[firstCountry]?.cities?.[firstCity]?.periods || {});
        const sortPeriods = (a, b) => {
          const [qa, ya] = a.split(" ");
          const [qb, yb] = b.split(" ");
          if (ya !== yb) return Number(ya) - Number(yb);
          return Number(qa.replace("Q", "")) - Number(qb.replace("Q", ""));
        };
        const sortedPeriods = periods.sort(sortPeriods);
        const firstPeriod = sortedPeriods[sortedPeriods.length - 1] || "";
        const subs = Object.keys(
          json?.countries?.[firstCountry]?.cities?.[firstCity]?.periods?.[firstPeriod]?.subMarkets || {}
        );

        setCountry(firstCountry);
        setCity(firstCity);
        setPeriod(firstPeriod);
        setSubmarket(subs[0] || "");
        setLoading(false);
      })
      .catch((err) => {
        setErrorLoading(err.message || String(err));
        setLoading(false);
      });
  }, []);

  const countries = Object.keys(raw?.countries || {});
  const cities = country ? Object.keys(raw?.countries?.[country]?.cities || {}) : [];
  const periodsAsc = city ? Object.keys(raw?.countries?.[country]?.cities?.[city]?.periods || {}) : [];
  const periodsDesc = [...periodsAsc].reverse();

  const selectedPeriodObj = raw?.countries?.[country]?.cities?.[city]?.periods?.[period] || {};
  const submarketsFromJson = selectedPeriodObj?.subMarkets ? Object.keys(selectedPeriodObj.subMarkets) : [];
  const cityObj = raw?.countries?.[country]?.cities?.[city] || {};
  const leasingCity = cityObj?.leasing || {};

  const metricSource =
    (submarket && selectedPeriodObj?.subMarkets?.[submarket]) ||
    selectedPeriodObj?.market ||
    null;

  const leasingSource =
    selectedPeriodObj?.subMarkets?.[submarket]?.leasing ||
    selectedPeriodObj?.leasing ||
    leasingCity ||
    {};

  const g = (key) => {
    if (!metricSource) return null;
    switch (key) {
      case "totalStock": return metricSource.totalStock ?? null;
      case "vacancy": return metricSource.vacancy ?? null;
      case "vacancyRate": return metricSource.vacancyRate ?? null;
      case "takeUp": return metricSource.takeUp ?? null;
      case "netAbsorption": return metricSource.netAbsorption ?? null;
      case "completionsYTD": return metricSource.completionsYTD ?? null;
      case "underConstruction": return metricSource.underConstruction ?? null;
      case "primeRentEurSqmMonth": return metricSource.primeRentEurSqmMonth ?? null;
      case "averageRentEurSqmMonth": return metricSource.averageRentEurSqmMonth ?? null;
      case "primeYield": return metricSource.primeYield ?? null;
      default: return metricSource[key] ?? null;
    }
  };

  if (loading) return <div style={{ padding: 30 }}>Loading…</div>;
  if (errorLoading) return <div style={{ padding: 30, color: "crimson" }}>Error loading data: {errorLoading}</div>;

  return (
    <div style={{ fontFamily: "Arial, sans-serif", padding: "20px" }}>
      <h1>{city || "Market"} Office Market</h1>

      <div>
        <select
          value={country}
          onChange={(e) => {
            const c = e.target.value;
            setCountry(c);
            const nextCities = Object.keys(raw?.countries?.[c]?.cities || {});
            const nextCity = nextCities[0] || "";
            setCity(nextCity);
            const nextPeriods = Object.keys(raw?.countries?.[c]?.cities?.[nextCity]?.periods || {});
            const nextLatest = nextPeriods[nextPeriods.length - 1] || "";
            setPeriod(nextLatest);
            const nextSubs = Object.keys(
              raw?.countries?.[c]?.cities?.[nextCity]?.periods?.[nextLatest]?.subMarkets || {}
            );
            setSubmarket(nextSubs[0] || "");
          }}
        >
          {countries.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          value={city}
          onChange={(e) => {
            const cityVal = e.target.value;
            setCity(cityVal);
            const nextPeriods = Object.keys(raw?.countries?.[country]?.cities?.[cityVal]?.periods || {});
            const nextLatest = nextPeriods[nextPeriods.length - 1] || "";
            setPeriod(nextLatest);
            const nextSubs = Object.keys(
              raw?.countries?.[country]?.cities?.[cityVal]?.periods?.[nextLatest]?.subMarkets || {}
            );
            setSubmarket(nextSubs[0] || "");
          }}
        >
          {cities.map((ct) => (
            <option key={ct} value={ct}>
              {ct}
            </option>
          ))}
        </select>

        {city === "Prague" && (
  <div style={{ marginTop: "20px", marginBottom: "20px" }}>
    <h3>📍 Select Submarket via Map</h3>
    <PragueMap
      onSubmarketSelect={(name) => {
        // Optional: normalize names if they differ between GeoJSON and market_data.json
        const match = submarketsFromJson.find(
          (s) => s.toLowerCase() === name.toLowerCase()
        );
        if (match) setSubmarket(match);
      }}
    />
  </div>
)}

        {city === "Bucharest" && (
          <div style={{ marginTop: "20px", marginBottom: "20px" }}>
            <h3>📍 Select Submarket via Map</h3>
            <BucharestMap
              onSubmarketSelect={(name) => {
                const match = submarketsFromJson.find((s) => s.toLowerCase() === name.toLowerCase());
                if (match) setSubmarket(match);
              }}
            />
            <p style={{ fontSize: "0.8rem", color: "#666" }}>
              Approximate submarket boundaries shown for orientation.
            </p>
          </div>
        )}

        {city === "Warsaw" && (
          <div style={{ marginTop: "20px", marginBottom: "20px" }}>
            <h3>📍 Select Submarket via Map</h3>
            <WarsawMap
              onSubmarketSelect={(name) => {
                const match = submarketsFromJson.find((s) => s.toLowerCase() === name.toLowerCase());
                if (match) setSubmarket(match);
              }}
            />
            <p style={{ fontSize: "0.8rem", color: "#666" }}>
              Approximate submarket boundaries shown for orientation.
            </p>
          </div>
        )}


        <select value={submarket} onChange={(e) => setSubmarket(e.target.value)}>
          {submarketsFromJson.map((sm) => (
            <option key={sm} value={sm}>
              {sm}
            </option>
          ))}
        </select>

        <select value={period} onChange={(e) => setPeriod(e.target.value)}>
          {periodsDesc.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      <h2>
        {city} — {period} — {submarket || "City total"}
      </h2>

      <div className="section-box">
        <div className="section-header">
          <span>📊</span> Market Metrics
        </div>

        <Row label="Total Stock (sqm)" value={fmtNumber(g("totalStock"))} />
        <Row label="Vacancy (sqm)" value={fmtNumber(g("vacancy"))} />
        <Row
          label="Vacancy Rate (%)"
          value={fmtPercent(
            (() => {
              const vr = coerceNumber(g("vacancyRate"));
              if (vr === null) return null;
              return Math.abs(vr) <= 1 ? vr * 100 : vr;
            })()
          )}
        />
        <Row label="Take-up (sqm)" value={fmtNumber(g("takeUp"))} />
        <Row label="Net Absorption (sqm, YTD)" value={fmtNumber(g("netAbsorption"))} />
        <Row label="Completed (sqm, YTD)" value={fmtNumber(g("completionsYTD"))} />
        <Row label="Under Construction (sqm)" value={fmtNumber(g("underConstruction"))} />
        <Row label="Prime Rent (€/sqm/month)" value={fmtMoney(coerceNumber(g("primeRentEurSqmMonth")))} />
        <Row label="Average Rent (€/sqm/month)" value={fmtMoney(coerceNumber(g("averageRentEurSqmMonth")))} />
        <Row
          label="Prime Yield (%)"
          value={fmtPercent(
            (() => {
              const py = coerceNumber(g("primeYield"));
              if (py === null) return null;
              return Math.abs(py) <= 1 ? py * 100 : py;
            })()
          )}
        />
      </div>

      <div className="section-box">
        <div className="section-header">
          <span>📝</span> Leasing Conditions
        </div>
        <Row
          label="Typical rent-free period (month/year)"
          value={formatMaybeRange(leasingSource?.rentFreeMonthPerYear, "number")}
        />
        <Row
          label="Typical lease length (months)"
          value={formatMaybeRange(leasingSource?.leaseLengthMonths, "number")}
        />
        <Row
          label="Fit-out (€/sqm)"
          value={formatMaybeRange(leasingSource?.fitOutEurSqmShellCore, "money")}
        />
        <Row
          label="Service charge (€/sqm/month)"
          value={formatMaybeRange(leasingSource?.serviceChargeEurSqmMonth, "money")}
        />
      </div>

      <div className="section-box">
        <div className="section-header section-header--green">
          <span>📈</span> Historical Trend
        </div>
        <div style={{ padding: "10px" }}>
          <select
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value)}
            style={{ width: "100%", padding: "8px", fontSize: "15px", marginBottom: "10px" }}
          >
            {[
              { key: "totalStock", label: "Total Stock (sqm)" },
              { key: "vacancy", label: "Vacancy (sqm)" },
              { key: "vacancyRate", label: "Vacancy Rate (%)" },
              { key: "takeUp", label: "Take-up (sqm, YTD)" },
              { key: "primeRentEurSqmMonth", label: "Prime Rent (€/sqm/month)" },
              { key: "averageRentEurSqmMonth", label: "Average Rent (€/sqm/month)" },
              { key: "primeYield", label: "Prime Yield (%)" },
              { key: "fitOutEurSqmShellCore", label: "Fit-out (€/sqm)" },
              { key: "serviceChargeEurSqmMonth", label: "Service charge (€/sqm/month)" },
            ].map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>

          <BarTrendChart
            data={buildTrendSeries(raw, country, city, submarket, selectedMetric)}
            metric={selectedMetric}
          />
        </div>
      </div>

      <ComparisonBlock raw={raw} baseCountry={country} baseCity={city} baseSubmarket={submarket} />
    </div>
  );
}
