// functions/p/[[id]].js — Ozvion share page (v2, app-style redesign)

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
  if (!post) return notFoundPage(appName, siteUrl, webUrl);

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
  const isNsfw = !!post.is_nsfw;
  const isSpoiler = !!post.is_spoiler;
  const isSensitive = isNsfw || isSpoiler;

  const description = buildDescription(post.body, isNsfw, isSpoiler);

  const hero = pickHero(post, siteUrl);

  // Never leak NSFW/spoiler media into link previews.
  const ogImage = isSensitive
    ? `${siteUrl}/og-default.png`
    : hero.poster || `${siteUrl}/og-default.png`;

  const username =
    safeText(profile?.display_name) ||
    safeText(profile?.username) ||
    safeText(profile?.full_name) ||
    "Ozvion member";

  const userAvatar = pickFirstHttp(profile?.avatar_url);

  const communityName = safeText(community?.name) || appName;
  const communityHandle = normalizeHandle(safeText(community?.handle), communityName);
  const communityIcon = pickFirstHttp(community?.icon_url);
  const communityUrl = joinUrl(siteUrl, safeText(community?.handle));

  const createdAt = safeText(post.created_at);
  const timeAgoText = createdAt ? timeAgo(createdAt) : "";

  const storeUrl = iosStoreUrl || androidStoreUrl || "";

  // Inline SVG fallbacks (no more broken "?" icons if PNGs are missing)
  const planeFallback = svgDataUri(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='14' fill='%23F25A1F'/><path d='M52 32 14 16l6 14-6 2 6 2-6 14z' fill='white'/></svg>`
  );
  const personFallback = svgDataUri(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='32' fill='%231C2836'/><circle cx='32' cy='25' r='11' fill='%236B7A8F'/><path d='M12 56c3-12 12-17 20-17s17 5 20 17z' fill='%236B7A8F'/></svg>`
  );

  const heroHtml = renderHero(hero, post.media_type, isNsfw, isSpoiler);

  const videoMeta =
    hero.type === "video" && !isSensitive && hero.url
      ? `
  <meta property="og:video" content="${escapeHtml(hero.url)}" />
  <meta property="og:video:secure_url" content="${escapeHtml(hero.url)}" />
  <meta property="og:video:type" content="video/mp4" />`
      : "";

  // ---------- HTML ----------
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="#0E141D" />
  <title>${escapeHtml(title)} — ${escapeHtml(appName)}</title>

  <!-- Open Graph -->
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${escapeHtml(ogImage)}" />
  <meta property="og:url" content="${escapeHtml(pageUrl)}" />
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="${escapeHtml(appName)} — The Aviation Community" />${videoMeta}

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

  <style>
    :root {
      /* Matches the iOS app: ozBg ≈ #121A24, orange brand accent */
      --bg: #0E141D;
      --card: #121A24;
      --card-elevated: #17212E;
      --chip: rgba(255, 255, 255, 0.06);
      --text: #F2F5F9;
      --text-secondary: rgba(190, 201, 214, 0.85);
      --text-tertiary: rgba(148, 161, 178, 0.6);
      --accent: #F25A1F;
      --accent-soft: #FF7A3C;
      --border: rgba(255, 255, 255, 0.07);
      --danger: #FF4757;
      --radius: 18px;
      --font: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI",
        Roboto, "Helvetica Neue", Arial, sans-serif;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    html { background: var(--bg); }

    body {
      font-family: var(--font);
      background:
        radial-gradient(ellipse 700px 420px at 50% -10%, rgba(242, 90, 31, 0.07), transparent 65%),
        var(--bg);
      color: var(--text);
      min-height: 100vh;
      -webkit-font-smoothing: antialiased;
      overflow-x: hidden;
    }

    .wrap { max-width: 640px; margin: 0 auto; padding: 0 16px; }

    /* ===== STICKY TOP BAR ===== */
    .topBanner {
      position: sticky;
      top: 0;
      z-index: 100;
      background: rgba(14, 20, 29, 0.85);
      backdrop-filter: blur(18px) saturate(1.3);
      -webkit-backdrop-filter: blur(18px) saturate(1.3);
      border-bottom: 1px solid var(--border);
      transition: transform 0.25s ease;
    }
    .topBanner.hidden { transform: translateY(-100%); }
    .topBannerInner {
      max-width: 640px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      height: 60px;
      padding: 0 16px;
    }
    .topLeft { display: flex; align-items: center; gap: 10px; min-width: 0; }
    .appIcon {
      width: 36px; height: 36px;
      border-radius: 9px;
      object-fit: cover;
      flex-shrink: 0;
    }
    .topAppName { font-size: 15px; font-weight: 800; letter-spacing: -0.02em; }
    .topSub { font-size: 11.5px; color: var(--text-tertiary); }
    .topRight { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
    .topClose {
      width: 30px; height: 30px;
      border-radius: 999px;
      border: none;
      background: var(--chip);
      color: var(--text-tertiary);
      cursor: pointer;
      font-size: 13px;
      display: flex; align-items: center; justify-content: center;
    }

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
      transition: transform 0.12s ease, box-shadow 0.15s ease, background 0.15s ease;
      letter-spacing: -0.01em;
    }
    .btn:active { transform: scale(0.97); }

    .btn-primary {
      background: linear-gradient(135deg, var(--accent), var(--accent-soft));
      color: #fff;
      border-radius: 999px;
      padding: 9px 18px;
      font-size: 13.5px;
      font-weight: 800;
      box-shadow: 0 4px 18px rgba(242, 90, 31, 0.30);
    }
    .btn-primary:hover { box-shadow: 0 6px 24px rgba(242, 90, 31, 0.42); }

    .btn-ghost {
      background: var(--chip);
      color: var(--text-secondary);
      border: 1px solid var(--border);
      border-radius: 999px;
      padding: 9px 16px;
      font-size: 13px;
    }
    .btn-ghost:hover { background: rgba(255,255,255,0.09); color: var(--text); }

    .btn-cta {
      width: 100%;
      background: linear-gradient(135deg, var(--accent), var(--accent-soft));
      color: #fff;
      font-weight: 800;
      border-radius: 999px;
      padding: 16px 28px;
      font-size: 16px;
      letter-spacing: -0.02em;
      box-shadow:
        0 8px 30px rgba(242, 90, 31, 0.35),
        inset 0 1px 0 rgba(255, 255, 255, 0.18);
    }
    .btn-cta:hover { box-shadow: 0 10px 38px rgba(242, 90, 31, 0.48); }

    /* ===== CARD ===== */
    .card {
      margin-top: 16px;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      overflow: hidden;
      box-shadow: 0 22px 60px rgba(0, 0, 0, 0.45);
      animation: cardEnter 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
    }
    @keyframes cardEnter {
      from { opacity: 0; transform: translateY(16px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* ===== COMMUNITY BAR ===== */
    .communityBar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 16px;
      border-bottom: 1px solid var(--border);
    }
    .communityLeft {
      display: flex; align-items: center; gap: 10px; min-width: 0;
      text-decoration: none; color: inherit;
    }
    .cIcon {
      width: 34px; height: 34px;
      border-radius: 999px;
      object-fit: cover;
      background: var(--card-elevated);
      flex-shrink: 0;
    }
    .cName { font-size: 14px; font-weight: 800; letter-spacing: -0.01em; }
    .cSub { font-size: 11.5px; color: var(--text-tertiary); }

    /* ===== HERO ===== */
    .hero {
      position: relative;
      width: 100%;
      aspect-ratio: 16/9;
      background: #000;
      overflow: hidden;
    }
    .hero video, .hero img.heroMedia {
      width: 100%; height: 100%;
      object-fit: cover;
      display: block;
    }
    .hero.sensitive video,
    .hero.sensitive img.heroMedia {
      filter: blur(34px) brightness(0.55);
      transform: scale(1.1);
    }
    .hero.revealed video,
    .hero.revealed img.heroMedia {
      filter: none;
      transform: none;
    }
    .sensitiveOverlay {
      position: absolute;
      inset: 0;
      z-index: 3;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      background: rgba(0, 0, 0, 0.25);
    }
    .hero.revealed .sensitiveOverlay { display: none; }
    .sensitiveLabel {
      font-size: 14px;
      font-weight: 800;
      letter-spacing: 0.02em;
      color: #fff;
      text-shadow: 0 2px 10px rgba(0,0,0,0.6);
    }
    .revealBtn {
      background: #fff;
      color: #000;
      border: none;
      border-radius: 999px;
      padding: 11px 26px;
      font-size: 14.5px;
      font-weight: 800;
      font-family: var(--font);
      cursor: pointer;
    }
    .hero-badge {
      position: absolute;
      bottom: 12px; left: 12px;
      z-index: 2;
      font-size: 10.5px;
      font-weight: 800;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      padding: 5px 10px;
      border-radius: 999px;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(8px);
      color: rgba(255, 255, 255, 0.9);
    }

    /* ===== META ===== */
    .meta { padding: 16px; }

    .authorRow {
      display: flex; align-items: center; gap: 10px;
      margin-bottom: 12px;
    }
    .uAvatar {
      width: 34px; height: 34px;
      border-radius: 999px;
      object-fit: cover;
      background: var(--card-elevated);
      flex-shrink: 0;
    }
    .authorName { font-size: 13.5px; font-weight: 700; }
    .authorMeta {
      font-size: 12px;
      color: var(--text-tertiary);
      display: flex; align-items: center; gap: 5px;
    }

    .postTitle {
      font-size: 24px;
      line-height: 1.2;
      font-weight: 800;
      letter-spacing: -0.02em;
      margin-bottom: 8px;
    }
    .postBody {
      color: var(--text-secondary);
      font-size: 14.5px;
      line-height: 1.55;
      white-space: pre-wrap;
    }

    .tags { margin-top: 12px; display: flex; gap: 6px; flex-wrap: wrap; }
    .pill {
      font-size: 10.5px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      padding: 5px 11px;
      border-radius: 999px;
      background: var(--chip);
      border: 1px solid var(--border);
      color: var(--text-secondary);
    }
    .pill.danger {
      background: rgba(255, 71, 87, 0.10);
      border-color: rgba(255, 71, 87, 0.22);
      color: rgba(255, 99, 112, 0.95);
    }

    /* ===== CTA ===== */
    .ctaSection {
      border-top: 1px solid var(--border);
      padding: 24px 16px 22px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      background: linear-gradient(180deg, rgba(242, 90, 31, 0.05), transparent 70%);
    }
    .ctaHeadline {
      font-size: 15px;
      font-weight: 700;
      text-align: center;
      letter-spacing: -0.01em;
    }
    .ctaHeadline strong { color: var(--accent-soft); font-weight: 800; }
    .ctaSub {
      font-size: 12px;
      color: var(--text-tertiary);
      text-align: center;
      margin-top: -6px;
    }
    .ctaStore {
      font-size: 13px;
      color: var(--text-tertiary);
      text-decoration: none;
      padding: 6px 10px;
    }
    .ctaStore:hover { color: var(--text-secondary); }

    /* ===== FOOTER ===== */
    .footer {
      margin-top: 24px;
      padding-bottom: 110px; /* room for floating bar */
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }
    .footerLogo {
      width: 30px; height: 30px;
      border-radius: 8px;
    }
    .footerBrand {
      font-size: 12px;
      font-weight: 700;
      color: var(--text-tertiary);
      letter-spacing: 0.02em;
    }

    /* ===== FLOATING BOTTOM BAR (MOBILE) ===== */
    .floatingBar {
      position: fixed;
      bottom: 0;
      left: 0; right: 0;
      z-index: 90;
      padding: 12px 16px calc(env(safe-area-inset-bottom, 8px) + 12px);
      background: rgba(14, 20, 29, 0.9);
      backdrop-filter: blur(18px) saturate(1.3);
      -webkit-backdrop-filter: blur(18px) saturate(1.3);
      border-top: 1px solid var(--border);
      animation: floatUp 0.45s cubic-bezier(0.16, 1, 0.3, 1) both;
      animation-delay: 0.5s;
    }
    @keyframes floatUp {
      from { opacity: 0; transform: translateY(100%); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .floatingBarInner {
      max-width: 640px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .floatingBarText { flex: 1; min-width: 0; }
    .floatingBarText p:first-child { font-size: 13px; font-weight: 800; }
    .floatingBarText p:last-child { font-size: 11.5px; color: var(--text-tertiary); }

    @media (max-width: 520px) {
      .postTitle { font-size: 21px; }
    }
    @media (min-width: 768px) {
      .floatingBar { display: none; }
      .footer { padding-bottom: 40px; }
    }
  </style>
</head>

<body>
  <!-- ===== STICKY TOP BANNER ===== -->
  <div class="topBanner" id="topBanner">
    <div class="topBannerInner">
      <div class="topLeft">
        <img class="appIcon" src="${escapeHtml(appIconUrl)}" alt="${escapeHtml(appName)}"
             onerror="this.onerror=null;this.src='${planeFallback}'" />
        <div>
          <div class="topAppName">${escapeHtml(appName)}</div>
          <div class="topSub">The Aviation Community</div>
        </div>
      </div>
      <div class="topRight">
        <a class="btn btn-primary" href="#" id="topOpenBtn">Get the App</a>
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
          <img class="cIcon" src="${escapeHtml(communityIcon || planeFallback)}" alt="${escapeHtml(communityHandle)}"
               onerror="this.onerror=null;this.src='${planeFallback}'" />
          <div>
            <div class="cName">${escapeHtml(communityHandle)}</div>
            <div class="cSub">${escapeHtml(communityName)}</div>
          </div>
        </a>
      </div>

      <!-- Hero Media -->
      ${heroHtml}

      <!-- Post Content -->
      <div class="meta">
        <div class="authorRow">
          <img class="uAvatar" src="${escapeHtml(userAvatar || personFallback)}" alt="${escapeHtml(username)}"
               onerror="this.onerror=null;this.src='${personFallback}'" />
          <div>
            <div class="authorName">${escapeHtml(username)}</div>
            <div class="authorMeta">
              <span>${escapeHtml(communityHandle)}</span>
              ${timeAgoText ? `<span>·</span><span>${escapeHtml(timeAgoText)}</span>` : ""}
            </div>
          </div>
        </div>

        <h1 class="postTitle">${escapeHtml(title)}</h1>
        ${post.body ? `<p class="postBody">${escapeHtml(stripAndTrim(String(post.body), 400))}</p>` : ""}

        ${
          isNsfw || isSpoiler || post.link_url
            ? `<div class="tags">
                ${isNsfw ? `<span class="pill danger">NSFW</span>` : ""}
                ${isSpoiler ? `<span class="pill danger">Spoiler</span>` : ""}
                ${post.link_url ? `<span class="pill">Link</span>` : ""}
              </div>`
            : ""
        }
      </div>

      <!-- CTA -->
      <div class="ctaSection">
        <div class="ctaHeadline">See the full post in <strong>${escapeHtml(appName)}</strong></div>
        <div class="ctaSub">Comments · Votes · Live streams · The aviation community</div>
        <a class="btn btn-cta" href="#" id="mainOpenBtn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>
          Open in ${escapeHtml(appName)}
        </a>
        ${
          storeUrl
            ? `<a class="ctaStore" href="${escapeHtml(storeUrl)}" rel="noopener">Don't have the app? Download it free →</a>`
            : ""
        }
      </div>

    </div>

    <!-- Footer -->
    <div class="footer">
      <img class="footerLogo" src="${escapeHtml(appIconUrl)}" alt=""
           onerror="this.onerror=null;this.src='${planeFallback}'" />
      <div class="footerBrand">${escapeHtml(appName)} — The Aviation Community</div>
    </div>
  </div>

  <!-- ===== FLOATING BOTTOM BAR (MOBILE) ===== -->
  <div class="floatingBar" id="floatingBar">
    <div class="floatingBarInner">
      <img class="appIcon" src="${escapeHtml(appIconUrl)}" alt=""
           style="width:34px;height:34px;border-radius:8px;"
           onerror="this.onerror=null;this.src='${planeFallback}'" />
      <div class="floatingBarText">
        <p>Open in ${escapeHtml(appName)}</p>
        <p>Full post, comments &amp; more</p>
      </div>
      <a class="btn btn-primary" href="#" id="floatOpenBtn" style="padding:10px 18px;font-size:13px;">Open</a>
    </div>
  </div>

  <script>
    (function(){
      var DEEP_LINK = ${JSON.stringify(deepLink)};
      var STORE_URL = ${JSON.stringify(storeUrl)};

      // --- Banner close (persist per session) ---
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

      // --- Smart open: try the app, fall back to the store ---
      // Only on user tap (no auto-redirect on load: that shows an ugly
      // "address invalid" alert on iOS for users without the app).
      function smartOpen(e) {
        e.preventDefault();
        var fellBack = false;
        var onHide = function() { fellBack = true; };
        document.addEventListener('visibilitychange', onHide, { once: true });

        window.location.href = DEEP_LINK;

        setTimeout(function() {
          document.removeEventListener('visibilitychange', onHide);
          // Still visible after 1.4s → app not installed → go to store
          if (!fellBack && !document.hidden && STORE_URL) {
            window.location.href = STORE_URL;
          }
        }, 1400);
      }

      ['topOpenBtn', 'mainOpenBtn', 'floatOpenBtn'].forEach(function(btnId){
        var el = document.getElementById(btnId);
        if (el) el.addEventListener('click', smartOpen);
      });

      // --- NSFW / spoiler reveal ---
      var revealBtn = document.getElementById('revealBtn');
      var heroEl = document.getElementById('heroEl');
      if (revealBtn && heroEl) {
        revealBtn.addEventListener('click', function(){
          heroEl.classList.add('revealed');
        });
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

function notFoundPage(appName, siteUrl, webUrl) {
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="theme-color" content="#0E141D" />
  <title>Post not found — ${escapeHtml(appName)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0E141D; color: #F2F5F9; min-height: 100vh; margin: 0;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 14px; padding: 24px; text-align: center; }
    h1 { font-size: 22px; letter-spacing: -0.02em; }
    p { color: rgba(148,161,178,0.8); font-size: 14px; max-width: 320px; line-height: 1.5; }
    a { display: inline-flex; margin-top: 8px; background: linear-gradient(135deg,#F25A1F,#FF7A3C);
      color: #fff; text-decoration: none; font-weight: 800; padding: 12px 26px;
      border-radius: 999px; font-size: 14px; }
  </style>
</head>
<body>
  <h1>This post is no longer available</h1>
  <p>It may have been removed by its author. Discover more aviation content on ${escapeHtml(appName)}.</p>
  <a href="${escapeHtml(webUrl || siteUrl)}">Visit ${escapeHtml(appName)}</a>
</body>
</html>`;
  return new Response(html, {
    status: 404,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
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
    return { type: "video", url: mediaUrl, poster: thumbUrl || "" };
  }
  if (mediaType === "image" && mediaUrl) {
    return { type: "image", url: mediaUrl, poster: mediaUrl };
  }
  if (thumbUrl) return { type: "image", url: thumbUrl, poster: thumbUrl };

  return { type: "none", url: "", poster: "" };
}

function renderHero(hero, mediaType, isNsfw, isSpoiler) {
  if (hero.type === "none") return "";

  const sensitive = isNsfw || isSpoiler;
  const sensitiveLabel = isNsfw ? "NSFW content" : "Spoiler";
  const heroClass = sensitive ? "hero sensitive" : "hero";

  const overlay = sensitive
    ? `<div class="sensitiveOverlay">
        <div class="sensitiveLabel">${escapeHtml(sensitiveLabel)}</div>
        <button class="revealBtn" id="revealBtn" type="button">Reveal</button>
      </div>`
    : "";

  const badge =
    hero.type === "video"
      ? `<div class="hero-badge">Video</div>`
      : "";

  if (hero.type === "video") {
    // No preload/controls until revealed for sensitive content
    return `
      <div class="${heroClass}" id="heroEl">
        <video controls playsinline webkit-playsinline preload="metadata"
          ${hero.poster ? `poster="${escapeHtml(hero.poster)}"` : ""}
          src="${escapeHtml(hero.url)}"></video>
        ${badge}
        ${overlay}
      </div>`;
  }
  return `
    <div class="${heroClass}" id="heroEl">
      <img class="heroMedia" src="${escapeHtml(hero.url)}" alt="Post media" loading="eager" />
      ${badge}
      ${overlay}
    </div>`;
}

function buildDescription(body, isNsfw, isSpoiler) {
  const tags = [];
  if (isNsfw) tags.push("NSFW");
  if (isSpoiler) tags.push("Spoiler");
  const prefix = tags.length ? `[${tags.join(" · ")}] ` : "";
  const t = body
    ? stripAndTrim(String(body), 160)
    : "Join the aviation community — spotting, streams and more on Ozvion.";
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

function normalizeHandle(handle, fallbackName) {
  // App shows communities as "o/elal" — mirror that here.
  let h = safeText(handle);
  if (!h) return `o/${fallbackName.toLowerCase().replace(/\s+/g, "")}`;
  h = h.replace(/^\/+/, "");
  return h.startsWith("o/") ? h : `o/${h}`;
}

function joinUrl(base, path) {
  const p = safeText(path);
  if (!p) return base;
  return `${base}/${p.replace(/^\/+/, "")}`;
}

function svgDataUri(svg) {
  return `data:image/svg+xml,${svg.replace(/#/g, "%23").replace(/"/g, "'")}`;
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
    ["y", 31536000],
    ["mo", 2592000],
    ["d", 86400],
    ["h", 3600],
    ["m", 60],
  ];

  for (const [name, secs] of units) {
    const v = Math.floor(abs / secs);
    if (v >= 1) return `${v}${name} ago`;
  }
  return "just now";
}
