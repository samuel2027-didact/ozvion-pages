// functions/p/[[id]].js

export async function onRequest(context) {
  const { params, env, request } = context;

  // ---------- Input ----------
  const id = String(params?.id || "").trim();
  if (!id) return text("Missing post id", 400);

  const supabaseUrl = String(env.SUPABASE_URL || "").replace(/\/$/, "");
  const serviceRoleKey = String(env.SUPABASE_SERVICE_ROLE_KEY || "");
  if (!supabaseUrl) return text("Missing SUPABASE_URL env var", 500);
  if (!serviceRoleKey) return text("Missing SUPABASE_SERVICE_ROLE_KEY env var", 500);

  // ---------- Site/App config ----------
  const siteUrl = String(env.SITE_URL || "https://ozvion.app").replace(/\/$/, "");
  const webUrl = String(env.WEB_URL || "https://ozvion.com").replace(/\/$/, "");

  const appScheme = String(env.APP_SCHEME || "ozvion");
  const appName = String(env.APP_NAME || "Ozvion");

  const appIconUrl = String(env.APP_ICON_URL || `${siteUrl}/app-icon.png`);
  const iosAppId = String(env.IOS_APP_ID || "");
  const iosStoreUrl = String(env.IOS_APP_STORE_URL || "");
  const androidStoreUrl = String(env.ANDROID_PLAY_STORE_URL || "");

  const pageUrl = new URL(request.url).toString();
  const deepLink = `${appScheme}://p/${encodeURIComponent(id)}`;

  // ---------- Fetch Post ----------
  const post = await fetchOne({
    supabaseUrl,
    serviceRoleKey,
    table: "posts",
    filter: `id=eq.${id}`,
    select:
      "id,title,body,thumbnail_url,media_url,media_type,is_nsfw,is_spoiler,link_url,created_at,user_id,community_id",
  });
  if (!post) return text("Post not found in DB", 404);

  // ---------- Fetch Profile + Community ----------
  const profile = post.user_id
    ? await fetchOne({
        supabaseUrl,
        serviceRoleKey,
        table: "profiles",
        filter: `id=eq.${post.user_id}`,
        select: "id,username,display_name,full_name,avatar_url",
      })
    : null;

  const community = post.community_id
    ? await fetchOne({
        supabaseUrl,
        serviceRoleKey,
        table: "communities",
        filter: `id=eq.${post.community_id}`,
        select: "id,name,handle,icon_url,banner_url,description",
      })
    : null;

  // ---------- Derived fields ----------
  const title = safeText(post.title) || appName;
  const description = buildDescription(post.body, post.is_nsfw, post.is_spoiler);

  const hero = pickHero(post, siteUrl);
  const ogImage = hero.poster || `${siteUrl}/og-default.png`;

  const username =
    safeText(profile?.display_name) ||
    safeText(profile?.username) ||
    safeText(profile?.full_name) ||
    "User";

  const userAvatar = pickFirstHttp(profile?.avatar_url) || `${siteUrl}/avatar-default.png`;

  const communityName = safeText(community?.name) || "Ozvion";
  const communityHandle = safeText(community?.handle) || "";
  const communityIcon = pickFirstHttp(community?.icon_url) || `${siteUrl}/community-default.png`;
  const communityUrl = communityHandle ? `${siteUrl}${communityHandle}` : siteUrl;

  const createdAt = safeText(post.created_at);
  const timeAgoText = createdAt ? timeAgo(createdAt) : "";

  const storeUrl = iosStoreUrl || androidStoreUrl || "";
  const bannerPrimaryLabel = storeUrl ? "Get the App" : "Open in App";
  const bannerPrimaryHref = storeUrl || deepLink;

  // ---------- HTML ----------
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>${escapeHtml(title)} — ${escapeHtml(appName)}</title>

  <!-- Open Graph -->
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${escapeHtml(ogImage)}" />
  <meta property="og:url" content="${escapeHtml(pageUrl)}" />
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="${escapeHtml(appName)}" />

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(ogImage)}" />

  ${
    iosAppId
      ? `<meta name="apple-itunes-app" content="app-id=${escapeHtml(
          iosAppId
        )}, app-argument=${escapeHtml(deepLink)}">`
      : ""
  }

  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,500;0,9..40,700;0,9..40,800;1,9..40,400&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet" />

  <style>
    :root {
      --bg: #06090e;
      --surface: rgba(12, 17, 28, 0.92);
      --surface-elevated: rgba(18, 25, 42, 0.88);
      --text: #e4eaf6;
      --text-secondary: rgba(159, 176, 212, 0.82);
      --text-tertiary: rgba(120, 140, 180, 0.6);
      --accent: #00d4ff;
      --accent-glow: rgba(0, 212, 255, 0.12);
      --accent-glow-strong: rgba(0, 212, 255, 0.25);
      --accent-warm: #4f8eff;
      --border: rgba(100, 160, 255, 0.08);
      --border-accent: rgba(0, 212, 255, 0.15);
      --danger: #ff4757;
      --success: #2ed573;
      --radius: 16px;
      --radius-sm: 10px;
      --font: 'DM Sans', system-ui, -apple-system, sans-serif;
      --mono: 'JetBrains Mono', 'SF Mono', monospace;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: var(--font);
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      overflow-x: hidden;
      -webkit-font-smoothing: antialiased;
    }

    /* ===== ANIMATED GRID BACKGROUND ===== */
    .grid-bg {
      position: fixed;
      inset: 0;
      z-index: 0;
      overflow: hidden;
      pointer-events: none;
    }
    .grid-bg::before {
      content: '';
      position: absolute;
      inset: -50%;
      background-image:
        linear-gradient(rgba(0, 212, 255, 0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(0, 212, 255, 0.03) 1px, transparent 1px);
      background-size: 60px 60px;
      animation: gridDrift 25s linear infinite;
    }
    .grid-bg::after {
      content: '';
      position: absolute;
      inset: 0;
      background:
        radial-gradient(ellipse 900px 500px at 50% -5%, rgba(0,212,255,.10), transparent 70%),
        radial-gradient(ellipse 600px 400px at 80% 20%, rgba(79,142,255,.06), transparent 60%),
        radial-gradient(ellipse 500px 500px at 10% 60%, rgba(0,212,255,.04), transparent 60%);
    }

    @keyframes gridDrift {
      0% { transform: translate(0, 0); }
      100% { transform: translate(60px, 60px); }
    }

    /* ===== FLOATING PARTICLES ===== */
    .particles {
      position: fixed;
      inset: 0;
      z-index: 0;
      pointer-events: none;
    }
    .particle {
      position: absolute;
      width: 2px;
      height: 2px;
      background: var(--accent);
      border-radius: 50%;
      opacity: 0;
      animation: particleFloat linear infinite;
    }
    .particle:nth-child(1) { left: 15%; animation-duration: 18s; animation-delay: 0s; }
    .particle:nth-child(2) { left: 35%; animation-duration: 22s; animation-delay: 3s; }
    .particle:nth-child(3) { left: 55%; animation-duration: 16s; animation-delay: 7s; }
    .particle:nth-child(4) { left: 75%; animation-duration: 20s; animation-delay: 2s; }
    .particle:nth-child(5) { left: 90%; animation-duration: 24s; animation-delay: 5s; }
    .particle:nth-child(6) { left: 5%;  animation-duration: 19s; animation-delay: 9s; }

    @keyframes particleFloat {
      0%   { transform: translateY(100vh) scale(1); opacity: 0; }
      10%  { opacity: 0.6; }
      90%  { opacity: 0.6; }
      100% { transform: translateY(-10vh) scale(0.5); opacity: 0; }
    }

    /* ===== LAYOUT ===== */
    .page-content {
      position: relative;
      z-index: 1;
    }
    .wrap {
      max-width: 680px;
      margin: 0 auto;
      padding: 0 16px;
    }

    /* ===== TOP BANNER (STICKY) ===== */
    .topBanner {
      position: sticky;
      top: 0;
      z-index: 100;
      background: rgba(6, 9, 14, 0.82);
      backdrop-filter: blur(20px) saturate(1.4);
      -webkit-backdrop-filter: blur(20px) saturate(1.4);
      border-bottom: 1px solid var(--border);
      padding: 0 16px;
      transition: transform 0.3s ease;
    }
    .topBanner.hidden { transform: translateY(-100%); }
    .topBannerInner {
      max-width: 680px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 62px;
      gap: 12px;
    }
    .topLeft { display: flex; align-items: center; gap: 12px; min-width: 0; }
    .topIcon {
      width: 38px; height: 38px;
      border-radius: 10px;
      border: 1px solid var(--border-accent);
      object-fit: cover;
      flex-shrink: 0;
      box-shadow: 0 0 16px rgba(0,212,255,.10);
    }
    .topText { min-width: 0; }
    .topAppName {
      font-size: 14px;
      font-weight: 700;
      letter-spacing: -0.01em;
      color: var(--text);
    }
    .topSub {
      font-size: 11.5px;
      color: var(--text-tertiary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 50vw;
      font-family: var(--mono);
      letter-spacing: 0.02em;
    }
    .topRight { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
    .topClose {
      width: 32px; height: 32px;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: transparent;
      color: var(--text-tertiary);
      cursor: pointer;
      font-size: 14px;
      display: flex; align-items: center; justify-content: center;
      transition: all 0.15s ease;
    }
    .topClose:hover { border-color: var(--border-accent); color: var(--text-secondary); }

    /* ===== BUTTONS ===== */
    .btn {
      appearance: none;
      border: 0;
      font-family: var(--font);
      font-weight: 700;
      cursor: pointer;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      white-space: nowrap;
      transition: all 0.15s ease;
      letter-spacing: -0.01em;
    }
    .btn:active { transform: scale(0.97); }

    .btn-primary {
      background: linear-gradient(135deg, #00d4ff, #4f8eff);
      color: #000;
      font-weight: 800;
      border-radius: 12px;
      padding: 10px 20px;
      font-size: 13.5px;
      box-shadow: 0 0 20px rgba(0,212,255,.20), inset 0 1px 0 rgba(255,255,255,.15);
      position: relative;
      overflow: hidden;
    }
    .btn-primary::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, rgba(255,255,255,.15), transparent 60%);
      opacity: 0;
      transition: opacity 0.15s ease;
    }
    .btn-primary:hover::before { opacity: 1; }
    .btn-primary:hover {
      box-shadow: 0 0 32px rgba(0,212,255,.35), inset 0 1px 0 rgba(255,255,255,.2);
    }

    .btn-ghost {
      background: rgba(255,255,255,0.04);
      color: var(--text-secondary);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 10px 18px;
      font-size: 13px;
    }
    .btn-ghost:hover {
      background: rgba(255,255,255,0.07);
      border-color: var(--border-accent);
      color: var(--text);
    }

    .btn-cta-large {
      background: linear-gradient(135deg, #00d4ff, #4f8eff);
      color: #000;
      font-weight: 800;
      border-radius: 16px;
      padding: 16px 32px;
      font-size: 16px;
      letter-spacing: -0.02em;
      width: 100%;
      box-shadow:
        0 0 40px rgba(0,212,255,.18),
        0 8px 32px rgba(0,0,0,.4),
        inset 0 1px 0 rgba(255,255,255,.15);
      position: relative;
      overflow: hidden;
    }
    .btn-cta-large::before {
      content: '';
      position: absolute;
      inset: -2px;
      border-radius: 18px;
      background: linear-gradient(135deg, rgba(0,212,255,.4), rgba(79,142,255,.4));
      z-index: -1;
      filter: blur(8px);
      opacity: 0;
      transition: opacity 0.3s ease;
    }
    .btn-cta-large:hover { box-shadow: 0 0 50px rgba(0,212,255,.30), 0 8px 32px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.2); }
    .btn-cta-large:hover::before { opacity: 1; }

    .btn-danger {
      background: rgba(255,71,87,.08);
      color: rgba(255,71,87,.9);
      border: 1px solid rgba(255,71,87,.15);
      border-radius: 12px;
      padding: 10px 18px;
      font-size: 13px;
    }
    .btn-danger:hover { background: rgba(255,71,87,.14); border-color: rgba(255,71,87,.25); }

    /* ===== CARD ===== */
    .card {
      margin-top: 16px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 20px;
      overflow: hidden;
      box-shadow:
        0 20px 60px rgba(0,0,0,.4),
        0 0 0 1px rgba(100,160,255,.04),
        inset 0 1px 0 rgba(255,255,255,.03);
      animation: cardEnter 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
      animation-delay: 0.1s;
    }
    @keyframes cardEnter {
      from { opacity: 0; transform: translateY(20px) scale(0.98); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }

    /* ===== COMMUNITY BAR ===== */
    .communityBar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 14px 18px;
      border-bottom: 1px solid var(--border);
      background: rgba(0,0,0,.18);
    }
    .communityLeft {
      display: flex; align-items: center; gap: 10px; min-width: 0;
      text-decoration: none; color: inherit;
    }
    .cIcon {
      width: 36px; height: 36px;
      border-radius: 10px;
      object-fit: cover;
      border: 1px solid var(--border-accent);
      background: #0a0f18;
      flex-shrink: 0;
    }
    .communityText { min-width: 0; }
    .cName {
      font-size: 14px;
      font-weight: 800;
      letter-spacing: -0.01em;
    }
    .cHandle {
      font-size: 11.5px;
      color: var(--text-tertiary);
      font-family: var(--mono);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      max-width: 50vw;
    }

    /* ===== HERO ===== */
    .hero {
      position: relative;
      width: 100%;
      aspect-ratio: 16/9;
      background: #000;
      overflow: hidden;
    }
    .hero video, .hero img {
      width: 100%; height: 100%;
      object-fit: cover;
      display: block;
    }
    /* Cinematic vignette */
    .hero::after {
      content: '';
      position: absolute;
      inset: 0;
      background:
        linear-gradient(0deg, rgba(6,9,14,.6) 0%, transparent 30%),
        linear-gradient(180deg, rgba(6,9,14,.3) 0%, transparent 15%);
      pointer-events: none;
    }
    /* Corner brackets (HUD-style) */
    .hero-hud {
      position: absolute;
      inset: 12px;
      z-index: 2;
      pointer-events: none;
    }
    .hero-hud::before, .hero-hud::after,
    .hero-hud-inner::before, .hero-hud-inner::after {
      content: '';
      position: absolute;
      width: 24px;
      height: 24px;
      border-color: rgba(0,212,255,.30);
      border-style: solid;
    }
    .hero-hud::before { top: 0; left: 0; border-width: 1px 0 0 1px; }
    .hero-hud::after { top: 0; right: 0; border-width: 1px 1px 0 0; }
    .hero-hud-inner::before { bottom: 0; left: 0; border-width: 0 0 1px 1px; }
    .hero-hud-inner::after { bottom: 0; right: 0; border-width: 0 1px 1px 0; }
    /* Type badge on hero */
    .hero-badge {
      position: absolute;
      bottom: 16px; left: 16px;
      z-index: 3;
      font-family: var(--mono);
      font-size: 10.5px;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      padding: 5px 10px;
      border-radius: 6px;
      background: rgba(0,0,0,.65);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(0,212,255,.15);
      color: var(--accent);
    }

    /* ===== META ===== */
    .meta { padding: 20px 18px 16px; }

    .authorRow {
      display: flex; align-items: center; gap: 10px;
      margin-bottom: 16px;
    }
    .uAvatar {
      width: 32px; height: 32px;
      border-radius: 999px;
      object-fit: cover;
      border: 1.5px solid var(--border-accent);
      background: #0a0f18;
      flex-shrink: 0;
    }
    .authorInfo { min-width: 0; flex: 1; }
    .authorName {
      font-size: 13.5px;
      font-weight: 700;
    }
    .authorMeta {
      font-size: 11.5px;
      font-family: var(--mono);
      color: var(--text-tertiary);
      display: flex; align-items: center; gap: 6px;
    }
    .authorMeta .dot { color: var(--accent); opacity: 0.5; }

    .postTitle {
      font-size: 28px;
      line-height: 1.15;
      font-weight: 800;
      letter-spacing: -0.03em;
      margin-bottom: 10px;
      background: linear-gradient(135deg, var(--text), rgba(159,176,212,.75));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .postBody {
      color: var(--text-secondary);
      font-size: 14.5px;
      line-height: 1.6;
      white-space: pre-wrap;
    }

    .tags { margin-top: 14px; display: flex; gap: 6px; flex-wrap: wrap; }
    .pill {
      font-family: var(--mono);
      font-size: 10.5px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      padding: 5px 10px;
      border-radius: 6px;
      background: rgba(255,255,255,.04);
      border: 1px solid var(--border);
      color: var(--text-secondary);
    }
    .pill.danger {
      background: rgba(255,71,87,.08);
      border-color: rgba(255,71,87,.18);
      color: rgba(255,71,87,.9);
    }

    /* ===== BLURRED OVERLAY / CTA SECTION ===== */
    .ctaOverlay {
      position: relative;
      border-top: 1px solid var(--border);
      background: rgba(0,0,0,.25);
      padding: 0;
      overflow: hidden;
    }
    .ctaBlur {
      padding: 28px 18px 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 14px;
      position: relative;
      z-index: 1;
    }
    .ctaOverlay::before {
      content: '';
      position: absolute;
      top: -1px; left: 50%; transform: translateX(-50%);
      width: 200px;
      height: 1px;
      background: linear-gradient(90deg, transparent, var(--accent), transparent);
    }
    .ctaHeadline {
      font-size: 15px;
      font-weight: 700;
      text-align: center;
      letter-spacing: -0.01em;
    }
    .ctaHeadline strong {
      color: var(--accent);
      font-weight: 800;
    }
    .ctaSub {
      font-size: 12px;
      color: var(--text-tertiary);
      text-align: center;
      font-family: var(--mono);
      letter-spacing: 0.02em;
    }

    .ctaActions {
      display: flex;
      gap: 10px;
      width: 100%;
      flex-wrap: wrap;
    }
    .ctaActions .btn-cta-large { flex: 1 1 100%; }

    .ctaSecondary {
      display: flex;
      gap: 8px;
      width: 100%;
      margin-top: 2px;
    }
    .ctaSecondary a { flex: 1; text-align: center; font-size: 12.5px; }

    /* ===== FLOATING BOTTOM BAR (MOBILE) ===== */
    .floatingBar {
      position: fixed;
      bottom: 0;
      left: 0; right: 0;
      z-index: 90;
      padding: 12px 16px calc(env(safe-area-inset-bottom, 8px) + 12px);
      background: rgba(6,9,14,.88);
      backdrop-filter: blur(20px) saturate(1.4);
      -webkit-backdrop-filter: blur(20px) saturate(1.4);
      border-top: 1px solid var(--border);
      animation: floatUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
      animation-delay: 0.8s;
    }
    @keyframes floatUp {
      from { opacity: 0; transform: translateY(100%); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .floatingBarInner {
      max-width: 680px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .floatingBarText {
      flex: 1;
      min-width: 0;
    }
    .floatingBarText p:first-child {
      font-size: 13px;
      font-weight: 700;
      letter-spacing: -0.01em;
    }
    .floatingBarText p:last-child {
      font-size: 11px;
      color: var(--text-tertiary);
      font-family: var(--mono);
    }
    .floatingBarBtn {
      flex-shrink: 0;
    }

    /* ===== POST ID FOOTER ===== */
    .footer {
      margin-top: 20px;
      padding-bottom: 100px; /* space for floating bar */
      text-align: center;
    }
    .footer-id {
      font-family: var(--mono);
      font-size: 10.5px;
      color: var(--text-tertiary);
      letter-spacing: 0.04em;
      opacity: 0.6;
    }
    .footer-brand {
      margin-top: 8px;
      font-size: 11px;
      color: var(--text-tertiary);
      opacity: 0.4;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      font-weight: 600;
    }

    /* ===== SCANLINE EFFECT (subtle) ===== */
    .scanline {
      position: fixed;
      top: 0; left: 0; right: 0;
      height: 2px;
      background: linear-gradient(90deg, transparent 20%, var(--accent) 50%, transparent 80%);
      opacity: 0.08;
      z-index: 200;
      animation: scanMove 4s linear infinite;
      pointer-events: none;
    }
    @keyframes scanMove {
      0%   { top: -2px; }
      100% { top: 100vh; }
    }

    /* ===== RESPONSIVE ===== */
    @media (max-width: 520px) {
      .postTitle { font-size: 24px; }
      .btn-cta-large { padding: 14px 24px; font-size: 15px; }
    }
    @media (min-width: 768px) {
      .floatingBar { display: none; }
    }
  </style>
</head>

<body>
  <!-- Ambient background -->
  <div class="grid-bg"></div>
  <div class="particles">
    <div class="particle"></div>
    <div class="particle"></div>
    <div class="particle"></div>
    <div class="particle"></div>
    <div class="particle"></div>
    <div class="particle"></div>
  </div>
  <div class="scanline"></div>

  <div class="page-content">

    <!-- ===== STICKY TOP BANNER ===== -->
    <div class="topBanner" id="topBanner">
      <div class="topBannerInner">
        <div class="topLeft">
          <img class="topIcon" src="${escapeHtml(appIconUrl)}" alt="${escapeHtml(appName)}" />
          <div class="topText">
            <div class="topAppName">${escapeHtml(appName)}</div>
            <div class="topSub">The Aviation Community</div>
          </div>
        </div>
        <div class="topRight">
          <a class="btn btn-primary" href="${escapeHtml(bannerPrimaryHref)}" rel="noopener">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            ${escapeHtml(bannerPrimaryLabel)}
          </a>
          <button class="topClose" id="bannerClose" aria-label="Close banner">✕</button>
        </div>
      </div>
    </div>

    <!-- ===== MAIN CARD ===== -->
    <div class="wrap">
      <div class="card">

        <!-- Community Bar -->
        <div class="communityBar">
          <a class="communityLeft" href="${escapeHtml(communityUrl)}" rel="noopener">
            <img class="cIcon" src="${escapeHtml(communityIcon)}" alt="${escapeHtml(communityName)}" />
            <div class="communityText">
              <div class="cName">${escapeHtml(communityName)}</div>
              <div class="cHandle">${escapeHtml(communityHandle || communityName)}</div>
            </div>
          </a>
          <a class="btn btn-ghost" href="${escapeHtml(webUrl)}" rel="noopener" style="font-size:12px;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            Website
          </a>
        </div>

        <!-- Hero Media -->
        ${renderHero(hero.type, hero.url, hero.poster || `${siteUrl}/og-default.png`, post.media_type)}

        <!-- Post Content -->
        <div class="meta">
          <div class="authorRow">
            <img class="uAvatar" src="${escapeHtml(userAvatar)}" alt="${escapeHtml(username)}" />
            <div class="authorInfo">
              <div class="authorName">${escapeHtml(username)}</div>
              <div class="authorMeta">
                <span>${escapeHtml(communityName)}</span>
                <span class="dot">·</span>
                <span>${escapeHtml(timeAgoText)}</span>
              </div>
            </div>
          </div>

          <h1 class="postTitle">${escapeHtml(title)}</h1>
          ${post.body ? `<p class="postBody">${escapeHtml(post.body)}</p>` : ""}

          <div class="tags">
            ${post.is_nsfw ? `<span class="pill danger">NSFW</span>` : ""}
            ${post.is_spoiler ? `<span class="pill danger">SPOILER</span>` : ""}
            ${post.media_type ? `<span class="pill">${escapeHtml(String(post.media_type).toUpperCase())}</span>` : ""}
            ${post.link_url ? `<span class="pill">LINK</span>` : ""}
          </div>
        </div>

        <!-- CTA Section -->
        <div class="ctaOverlay">
          <div class="ctaBlur">
            <div class="ctaHeadline">Continue in the <strong>${escapeHtml(appName)}</strong> app</div>
            <div class="ctaSub">Comments · Reactions · Full Experience</div>
            <div class="ctaActions">
              <a class="btn btn-cta-large" href="${escapeHtml(deepLink)}" rel="noopener">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                Open in ${escapeHtml(appName)}
              </a>
            </div>
            <div class="ctaSecondary">
              ${storeUrl ? `<a class="btn btn-ghost" href="${escapeHtml(storeUrl)}" rel="noopener">Download App</a>` : ""}
              <a class="btn btn-ghost" href="${escapeHtml(webUrl)}" rel="noopener">Visit Website</a>
              <a class="btn btn-danger" href="${escapeHtml(webUrl + "/login")}" rel="noopener">Login / Sign up</a>
            </div>
          </div>
        </div>

      </div>

      <!-- Footer -->
      <div class="footer">
        <div class="footer-id">ID: ${escapeHtml(String(post.id || id))}</div>
        <div class="footer-brand">${escapeHtml(appName)}</div>
      </div>
    </div>

    <!-- ===== FLOATING BOTTOM BAR (MOBILE) ===== -->
    <div class="floatingBar" id="floatingBar">
      <div class="floatingBarInner">
        <img class="topIcon" src="${escapeHtml(appIconUrl)}" alt="${escapeHtml(appName)}" style="width:34px;height:34px;border-radius:8px;" />
        <div class="floatingBarText">
          <p>Open in ${escapeHtml(appName)}</p>
          <p>See full post + comments</p>
        </div>
        <a class="btn btn-primary floatingBarBtn" href="${escapeHtml(bannerPrimaryHref)}" rel="noopener" style="padding:10px 18px;font-size:13px;">
          ${escapeHtml(bannerPrimaryLabel)}
        </a>
      </div>
    </div>

  </div>

  <script>
    (function(){
      // Banner close
      var banner = document.getElementById('topBanner');
      var closeBtn = document.getElementById('bannerClose');
      if (banner && closeBtn) {
        try {
          if (sessionStorage.getItem('ozvion_banner_closed') === '1') {
            banner.classList.add('hidden');
          }
          closeBtn.addEventListener('click', function(){
            banner.classList.add('hidden');
            sessionStorage.setItem('ozvion_banner_closed', '1');
          });
        } catch(e) {}
      }

      // Auto-try deep link on mobile
      var ua = navigator.userAgent || '';
      var isMobile = /iPhone|iPad|iPod|Android/i.test(ua);
      if (isMobile) {
        var deepLink = ${JSON.stringify(deepLink)};
        var timeout;
        // Try opening the app silently
        var start = Date.now();
        window.location.href = deepLink;
        timeout = setTimeout(function(){
          // If we're still here after 1.5s, app wasn't installed
          if (Date.now() - start < 2000) {
            // Don't redirect, user stays on page
          }
        }, 1500);
      }
    })();
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=60",
    },
  });
}

/* ---------------- Helpers ---------------- */

function text(msg, status = 200) {
  return new Response(String(msg), {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

async function fetchOne({ supabaseUrl, serviceRoleKey, table, filter, select }) {
  const qp = new URLSearchParams();
  qp.set("select", select);
  qp.set("limit", "1");

  const url = `${supabaseUrl}/rest/v1/${encodeURIComponent(table)}?${filter}&${qp.toString()}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) return null;

  const data = await res.json();
  return data?.[0] || null;
}

function pickHero(post, siteUrl) {
  const mediaType = safeText(post.media_type);
  const mediaUrl = pickFirstHttp(post.media_url);
  const thumbUrl = pickFirstHttp(post.thumbnail_url);

  if (mediaType === "video" && mediaUrl) {
    return { type: "video", url: mediaUrl, poster: thumbUrl || `${siteUrl}/og-default.png` };
  }
  if (mediaType === "image" && mediaUrl) {
    return { type: "image", url: mediaUrl, poster: mediaUrl };
  }
  if (thumbUrl) return { type: "image", url: thumbUrl, poster: thumbUrl };

  return { type: "image", url: `${siteUrl}/og-default.png`, poster: `${siteUrl}/og-default.png` };
}

function renderHero(type, url, poster, mediaType) {
  const badge = mediaType ? `<div class="hero-badge">${escapeHtml(String(mediaType))}</div>` : "";

  if (type === "video") {
    return `
      <div class="hero">
        <video controls playsinline webkit-playsinline preload="metadata"
          poster="${escapeHtml(poster)}" src="${escapeHtml(url)}"></video>
        <div class="hero-hud"><div class="hero-hud-inner"></div></div>
        ${badge}
      </div>`;
  }
  return `
    <div class="hero">
      <img src="${escapeHtml(url)}" alt="Post media" loading="eager" />
      <div class="hero-hud"><div class="hero-hud-inner"></div></div>
      ${badge}
    </div>`;
}

function buildDescription(body, isNsfw, isSpoiler) {
  const tags = [];
  if (isNsfw) tags.push("NSFW");
  if (isSpoiler) tags.push("Spoiler");
  const prefix = tags.length ? `[${tags.join(" · ")}] ` : "";
  const t = body ? stripAndTrim(String(body), 160) : "Check out this post on Ozvion — The Aviation Community.";
  return prefix + t;
}

function stripAndTrim(s, maxLen) {
  const stripped = s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  if (stripped.length <= maxLen) return stripped;
  return stripped.slice(0, maxLen - 1).trimEnd() + "…";
}

function safeText(v) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function pickFirstHttp(v) {
  const s = safeText(v);
  if (!s) return "";
  return s.startsWith("http://") || s.startsWith("https://") ? s : "";
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function timeAgo(isoString) {
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return "";

  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  const abs = Math.max(0, seconds);

  const units = [
    ["year", 31536000],
    ["month", 2592000],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];

  for (const [name, secs] of units) {
    const v = Math.floor(abs / secs);
    if (v >= 1) return `${v} ${name}${v === 1 ? "" : "s"} ago`;
  }
  return "just now";
}  
