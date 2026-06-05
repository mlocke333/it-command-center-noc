import React from "react";

export function timeAgo(ts) {
  if (!ts) return "—";
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function clockTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

/* ── KPI strip ────────────────────────────────────────────────────────── */
export function KpiStrip({ summary, tenantCount, erroredCount }) {
  const k = summary;
  const tiles = [
    { lbl: "Tenants Online", val: <>{tenantCount - erroredCount}<small>/{tenantCount}</small></>, tone: erroredCount ? "warn" : "ok", foot: erroredCount ? <span className="mut">{erroredCount} degraded</span> : <span className="up">all reporting</span> },
    { lbl: "SIEM Active", val: k.siem.active, tone: k.siem.high ? "err" : "info", foot: k.siem.high ? <span className="down">{k.siem.high} high · {k.siem.critical} crit</span> : <span className="dim">no high sev</span> },
    { lbl: "Devices Compliant", val: <>{k.mdm.compliant}<small>/{k.mdm.managed}</small></>, tone: "ok", foot: <span className="down">{k.mdm.nonCompliant} non-compliant</span> },
    { lbl: "MDR Incidents", val: k.mdr.incidents, tone: k.mdr.incidents ? "err" : "ok", foot: k.mdr.incidents ? <span className="down">open</span> : <span className="up">clear</span> },
    { lbl: "Network Online", val: <>{k.meraki.online}<small>/{k.meraki.devices}</small></>, tone: k.meraki.online < k.meraki.devices ? "warn" : "ok", foot: <span className="dim">{k.meraki.clients} clients</span> },
    { lbl: "RMM Online", val: <>{k.nsight.online}<small>/{k.nsight.devices}</small></>, tone: "info", foot: <span className="mut">{k.nsight.alerts} checks failing</span> },
    { lbl: "Sec Events 24h", val: k.meraki.securityEvents, tone: "warn", foot: <span className="dim">Meraki IDS</span> },
    { lbl: "Migrations Failed", val: k.migrations.failed, tone: k.migrations.failed ? "err" : "ok", foot: <span className="dim">of {k.migrations.jobs} jobs</span> },
  ];
  return (
    <section className="panel area-kpis">
      <header><span className="ttl">Operational Metrics</span><span className="meta">refreshing</span></header>
      <div className="kpis">
        {tiles.map((t, i) => (
          <div className="kpi" data-tone={t.tone} key={i}>
            <div className="lbl">{t.lbl}</div>
            <div className="val">{t.val}</div>
            <div className="foot">{t.foot}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── Tenant matrix ────────────────────────────────────────────────────── */
export function TenantMatrix({ tenants }) {
  const ordered = [...tenants].sort((a, b) => rank(b) - rank(a));
  return (
    <section className="panel area-tenants">
      <header><span className="ttl">Tenant Health Matrix</span><span className="meta">{tenants.length} connected</span></header>
      <div className="matrix">
        {ordered.map((t) => (
          <div className="cell" data-status={t.status} key={t.id}>
            <div className="row">
              <span className="nm">{t.name}</span>
              <span className="led" data-s={t.status} />
            </div>
            <div className="dom">{t.domain}</div>
            {t.errorMessage ? (
              <div className="errtxt">{t.errorMessage}</div>
            ) : (
              <div className="stat-line">
                <span>{t.devices ? <><b>{t.compliant}</b>/{t.devices} ok</> : "no devices"}</span>
                <span>sync {timeAgo(t.lastSyncAt)}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
function rank(t) { return t.status === "error" ? 3 : t.status === "warn" ? 2 : t.status === "syncing" ? 1 : 0; }

/* ── Connector strip ──────────────────────────────────────────────────── */
export function ConnectorStrip({ connectors }) {
  return (
    <section className="panel area-connectors">
      <header><span className="ttl">Connector Status</span><span className="meta">integrations</span></header>
      <div className="conns">
        {connectors.map((c) => {
          const state = !c.up ? "down" : c.degraded ? "degraded" : "up";
          return (
            <div className="conn" data-state={state} key={c.id}>
              <span className="led" data-s={state === "up" ? "active" : state === "degraded" ? "warn" : "error"} />
              <span className="nm">{c.name}</span>
              <span className="st">{state}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ── Live feed ────────────────────────────────────────────────────────── */
export function LiveFeed({ events }) {
  return (
    <section className="panel area-feed">
      <header>
        <span className="ttl">Live Alert Feed</span>
        <span className="meta">{events.length} events</span>
      </header>
      <div className="feed">
        {events.map((e, i) => (
          <div className={`feed-item${i === 0 && e.fresh ? " fresh" : ""}`} key={e.id}>
            <span className={`sev ${e.sev}`}>{e.sev}</span>
            <span className="body"><span className="tn">{e.tenant}</span> — {e.text}</span>
            <span className="ts">{clockTime(e.ts)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
