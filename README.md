body {
  margin: 0;
  font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: #06111b;
  color: #ecf2ff;
}

* { box-sizing: border-box; }

a { color: inherit; text-decoration: none; }
button, input, select, textarea { font: inherit; }

.landing-page {
  min-height: 100vh;
  background: radial-gradient(circle at top, rgba(74, 125, 235, 0.35), transparent 30%), linear-gradient(180deg, #050b14, #0d1729);
}

.topbar {
  width: min(1200px, calc(100% - 40px));
  margin: 0 auto;
  padding: 28px 0 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.brand-wrap, .brand-line {
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand-mark {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, #8cc3ff, #5b86ff);
  color: #071321;
  font-weight: 800;
}

.brand-name { font-weight: 700; }
.brand-tag { font-size: 12px; opacity: 0.72; }

nav {
  display: flex;
  align-items: center;
  gap: 18px;
}

.nav-button, .primary, .secondary, button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  padding: 12px 18px;
  transition: transform 0.2s ease;
}

.primary, .nav-button, button {
  background: linear-gradient(135deg, #8cc3ff, #5b86ff);
  border: 0;
  color: #071321;
  font-weight: 700;
  cursor: pointer;
}

.secondary {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255,255,255,0.08);
}

.hero {
  width: min(1200px, calc(100% - 40px));
  margin: 0 auto;
  padding: 40px 0 60px;
  display: grid;
  grid-template-columns: 1.2fr 0.8fr;
  gap: 24px;
  align-items: center;
}

.hero-copy h1 {
  font-size: clamp(2.7rem, 5vw, 5rem);
  margin: 12px 0 18px;
  line-height: 1.02;
}

.hero-copy p {
  font-size: 1.05rem;
  line-height: 1.75;
  color: rgba(236,242,255,0.8);
}

.eyebrow {
  display: inline-flex;
  padding: 7px 12px;
  border-radius: 999px;
  background: rgba(140,195,255,0.12);
  border: 1px solid rgba(140,195,255,0.2);
  color: #a9d1ff;
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.cta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 26px;
}

.mini-stats {
  list-style: none;
  padding: 0;
  margin: 28px 0 0;
  display: flex;
  gap: 18px;
  flex-wrap: wrap;
}

.mini-stats li {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 120px;
}

.mini-stats strong { font-size: 1.5rem; }

.panel, .sidebar, .main-panel, .auth-card {
  background: rgba(15,24,40,0.9);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 22px;
  box-shadow: 0 18px 36px rgba(0,0,0,0.22);
}

.hero-card { padding: 24px; }

.timeline-mini {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 20px;
}

.timeline-mini .bar {
  display: block;
  height: 46px;
  border-radius: 12px;
  background: linear-gradient(180deg, #7dbbff, #4d7cf4);
}

.timeline-mini .bar.short { width: 18%; }
.timeline-mini .bar.medium { width: 22%; }
.timeline-mini .bar.long { width: 38%; }

.metric-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(100px, 1fr));
  gap: 16px;
}

.metric-grid label {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  color: rgba(236,242,255,0.65);
}

.metric-grid strong { font-size: 1.2rem; }

.status-pill {
  display: inline-flex;
  margin-top: 18px;
  padding: 8px 12px;
  border-radius: 999px;
  font-size: 12px;
  letter-spacing: 0.04em;
}

.status-pill.success {
  background: rgba(66, 210, 140, 0.12);
  color: #72f3ae;
  border: 1px solid rgba(66,210,140,0.3);
}

.features, .rights, .connectors {
  width: min(1200px, calc(100% - 40px));
  margin: 0 auto 30px;
  padding: 28px;
}

.section-title h2 {
  margin-top: 12px;
  font-size: clamp(2rem, 5vw, 3rem);
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 18px;
}

.feature-grid article {
  padding: 20px;
  border-radius: 16px;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.06);
}

.feature-grid h3 {
  margin-top: 0;
  font-size: 1.18rem;
}

.feature-grid p,
.rights-list {
  color: rgba(236,242,255,0.72);
  line-height: 1.65;
}

.rights-list {
  margin: 0;
  padding-left: 18px;
}

.connector-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 16px;
}

.connector-grid span {
  min-height: 72px;
  display: grid;
  place-items: center;
  border-radius: 12px;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.06);
  font-weight: 600;
}

.app-body {
  background: #09131f;
}

.app-shell {
  width: min(1400px, calc(100% - 30px));
  margin: 24px auto;
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 24px;
}

.sidebar { padding: 22px; }
.main-panel { padding: 26px; }

.sidebar nav {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  margin: 28px 0;
}

.sidebar nav a {
  width: 100%;
  padding: 9px 12px;
  border-radius: 10px;
  color: rgba(236,242,255,0.8);
}

.sidebar nav a.active {
  background: rgba(140,195,255,0.12);
  color: #e4f1ff;
}

.form-card {
  margin-top: 18px;
}

.form-card h3 {
  margin-bottom: 12px;
}

.form-card input,
.form-card textarea,
.form-card select,
.card input,
.card select,
.card textarea,
.auth-card input,
.auth-card button,
button {
  width: 100%;
  margin-bottom: 10px;
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.03);
  color: white;
  padding: 10px 12px;
}

.checkbox-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: rgba(236,242,255,0.8);
}

.checkbox-row input {
  width: auto;
  margin: 0;
}

.top-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 20px;
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 16px;
  margin-bottom: 26px;
}

.kpi {
  padding: 18px;
  border-radius: 14px;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.06);
}

.kpi label {
  display: block;
  margin-bottom: 6px;
  color: rgba(236,242,255,0.65);
  font-size: 12px;
}

.kpi strong { font-size: 1.7rem; }

.content-grid {
  display: grid;
  grid-template-columns: 1.15fr 0.85fr;
  gap: 22px;
}

.card {
  padding: 18px;
  border-radius: 18px;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.06);
}

.card h3 { margin-top: 0; }

.list { display: flex; flex-direction: column; gap: 12px; }

.item {
  padding: 12px 14px;
  border-radius: 12px;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.05);
}

.project-actions { margin-top: 8px; }

.status {
  display: inline-flex;
  padding: 5px 8px;
  border-radius: 999px;
  font-size: 11px;
  margin-top: 8px;
}

.status.draft { background: rgba(255,177,66,0.12); color: #ffc166; }
.status.approved { background: rgba(70,221,130,0.12); color: #82f5b8; }
.status.failed { background: rgba(255,109,109,0.12); color: #ff9f9f; }

.section-inline { margin-top: 20px; }

.auth-shell {
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: linear-gradient(180deg, rgba(6,17,27,0.98), rgba(12,20,31,1));
}

.auth-card {
  width: min(420px, calc(100% - 36px));
  padding: 28px;
}

.auth-actions {
  display: flex;
  gap: 8px;
  margin: 18px 0;
}

.auth-actions button {
  width: 50%;
  background: rgba(255,255,255,0.04);
  color: white;
}

.auth-actions button.active {
  background: linear-gradient(135deg, #8cc3ff, #5b86ff);
  color: #071321;
}

.message {
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(255,255,255,0.04);
  color: rgba(236,242,255,0.8);
}

.message.success { background: rgba(66,210,140,0.12); color: #72f3ae; }
.message.error { background: rgba(255,109,109,0.12); color: #ffaba8; }

.hidden { display: none !important; }

@media (max-width: 980px) {
  .app-shell, .hero, .content-grid { grid-template-columns: 1fr; }
  .topbar { flex-direction: column; align-items: flex-start; gap: 16px; }
  nav { flex-wrap: wrap; }
}
