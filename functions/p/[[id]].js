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
  // siteUrl = host van je share pages / assets (ozvion.app)
  const siteUrl = String(env.SITE_URL || "https://ozvion.app").replace(/\/$/, "");
  // webUrl = je marketing/website domein waar “Website” knoppen naartoe moeten (ozvion.com)
  const webUrl = String(env.WEB_URL || "https://ozvion.com").replace(/\/$/, "");

  const appScheme = String(env.APP_SCHEME || "ozvion"); // ozvion://
  const appName = String(env.APP_NAME || "Ozvion");

  // Banner / Store links
  const appIconUrl = String(env.APP_ICON_URL || `${siteUrl}/app-icon.png`);
  const iosAppId = String(env.IOS_APP_ID || ""); // Smart Banner app-id (optioneel)
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

  // user
  const username =
    safeText(profile?.display_name) ||
    safeText(profile?.username) ||
    safeText(profile?.full_name) ||
    "User";

  const userAvatar = pickFirstHttp(profile?.avatar_url) || `${siteUrl}/avatar-default.png`;

  // community
  const communityName = safeText(community?.name) || "Ozvion";
  const communityHandle = safeText(community?.handle) || ""; // bij jou: "/tap"
  const communityIcon = pickFirstHttp(community?.icon_url) || `${siteUrl}/community-default.png`;
  const communityUrl = communityHandle ? `${siteUrl}${communityHandle}` : siteUrl;

  const createdAt = safeText(post.created_at);
  const timeAgoText = createdAt ? timeAgo(createdAt) : "";

  // Best CTA logic (Get vs Open)
  const storeUrl = iosStoreUrl || androidStoreUrl || "";
  const bannerPrimaryLabel = storeUrl ? "Get" : "Open";
  const bannerPrimaryHref = storeUrl || deepLink;

  // ---------- HTML ----------
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>${escapeHtml(title)}</title>

  <!-- Open Graph -->
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${escapeHtml(ogImage)}" />
  <meta property="og:url" content="${escapeHtml(pageUrl)}" />
  <meta property="og:type" content="article" />

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
    :root{
      --bg:#0b0f14;
      --card:#121826;
      --text:#e8eefc;
      --muted:#9fb0d0;
      --line:rgba(255,255,255,.10);
      --btn:#1f6feb;
      --btn2:rgba(255,255,255,.08);
      --danger:#ff3b30;
      --radius:18px;
      --shadow: 0 14px 40px rgba(0,0,0,.38);
    }
    *{ box-sizing:border-box; }
    body{
      margin:0;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial;
      background:
        radial-gradient(1200px 600px at 50% -10%, rgba(31,111,235,.18), transparent 60%),
        radial-gradient(900px 500px at 10% 10%, rgba(255,59,48,.10), transparent 55%),
        var(--bg);
      color:var(--text);
    }
    a{ color:inherit; }
    .wrap{ max-width: 920px; margin: 0 auto; padding: 14px 14px 44px; }

    .appBanner{
      position: sticky;
      top: 0;
      z-index: 50;
      padding: 10px 0;
      background: rgba(11,15,20,.86);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--line);
    }
    .appBannerInner{
      display:flex; align-items:center; gap:12px; justify-content:space-between;
    }
    .appLeft{ display:flex; align-items:center; gap:10px; min-width:0; }
    .appIcon{
      width:44px; height:44px; border-radius: 12px;
      border: 1px solid rgba(255,255,255,.12);
      object-fit: cover; background:#111;
      flex:0 0 auto;
    }
    .appText{ min-width:0; }
    .appName{ margin:0; font-size:14px; font-weight:800; letter-spacing:-0.01em; }
    .appSub{ margin:0; font-size:12px; color: rgba(159,176,208,.85);
      white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width: 56vw; }
    .appRight{ display:flex; align-items:center; gap:10px; }

    .btn{
      appearance:none; border:0; border-radius: 14px;
      padding: 10px 12px; font-weight:800; cursor:pointer;
      text-decoration:none; display:inline-flex; align-items:center; justify-content:center;
      gap:8px; white-space:nowrap;
      transition: transform .08s ease, opacity .08s ease;
    }
    .btn:active{ transform: scale(.98); opacity: .92; }
    .btn.primary{ background: var(--btn); color:white; }
    .btn.ghost{ background: var(--btn2); color:var(--text); border:1px solid var(--line); }
    .btn.danger{ background: rgba(255,59,48,.16); color:#fff; border: 1px solid rgba(255,59,48,.32); }
    .closeX{
      width:36px; height:36px; border-radius: 12px;
      border:1px solid var(--line); background: rgba(255,255,255,.06);
      color: rgba(232,238,252,.85);
      cursor:pointer; font-weight:900;
    }

    .card{
      margin-top: 14px;
      background: linear-gradient(180deg, rgba(18,24,38,.96), rgba(15,21,34,.96));
      border:1px solid var(--line);
      border-radius: var(--radius);
      overflow:hidden;
      box-shadow: var(--shadow);
    }

    .communityBar{
      display:flex; align-items:center; justify-content:space-between; gap:10px;
      padding: 12px 16px;
      border-bottom: 1px solid var(--line);
      background: rgba(0,0,0,.14);
    }
    .communityLeft{ display:flex; align-items:center; gap:10px; min-width:0; }
    .communityLeft .cIcon{
      width:34px; height:34px; border-radius: 10px; object-fit: cover;
      border:1px solid rgba(255,255,255,.12);
      background:#111; flex:0 0 auto;
    }
    .communityText{ min-width:0; }
    .communityName{ margin:0; font-size: 14px; font-weight: 900; letter-spacing:-.01em; }
    .communityHandle{ margin:0; font-size: 12px; color: rgba(159,176,208,.78);
      white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width: 55vw; }

    .hero{
      background:#000;
      aspect-ratio: 16/9;
      width:100%;
      display:block;
      position: relative;
    }
    .hero video,.hero img{
      width:100%; height:100%;
      object-fit:cover;
      display:block;
    }

    .meta{ padding: 16px 16px 12px; }
    .headerRow{
      display:flex; align-items:flex-start; gap:12px; justify-content:space-between;
      margin-bottom: 12px;
    }
    .who{ display:flex; align-items:center; gap:10px; min-width:0; }
    .uAvatar{
      width:28px; height:28px; border-radius: 999px; object-fit: cover;
      border:1px solid rgba(255,255,255,.12);
      background:#111; flex:0 0 auto;
    }
    .whoText{ min-width:0; }
    .line1{
      display:flex; align-items:center; gap:8px; flex-wrap:wrap;
      font-size: 13px; font-weight:800;
    }
    .line1 .muted{ color: rgba(159,176,208,.85); font-weight:700; }
    .line2{
      margin-top: 2px;
      font-size: 12px;
      color: rgba(159,176,208,.78);
      white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
      max-width: 70vw;
    }

    .title{ font-size: 34px; line-height: 1.12; margin: 0 0 8px; letter-spacing: -0.02em; }
    .desc{ margin:0; color: var(--muted); font-size: 15px; line-height: 1.5; white-space: pre-wrap; }

    .tags{ margin-top: 12px; display:flex; gap:8px; flex-wrap:wrap; }
    .pill{
      font-size: 12px; padding: 6px 10px; border-radius: 999px;
      background: rgba(255,255,255,.08); border: 1px solid var(--line);
      color: rgba(232,238,252,.9);
    }
    .pill.danger{ background: rgba(255,59,48,.18); border-color: rgba(255,59,48,.30); }

    .actions{
      display:flex; gap:10px; flex-wrap:wrap;
      padding: 14px 16px 16px;
      border-top: 1px solid var(--line);
      background: rgba(0,0,0,.12);
    }

    .small{ margin-top: 12px; color: rgba(159,176,208,.65); font-size: 12px; text-align:center; }

    @media (max-width: 520px){
      .title{ font-size: 28px; }
      .appSub{ max-width: 48vw; }
    }
  </style>
</head>

<body>
  <div class="appBanner" id="appBanner">
    <div class="wrap">
      <div class="appBannerInner">
        <div class="appLeft">
          <img class="appIcon" src="${escapeHtml(appIconUrl)}" alt="${escapeHtml(appName)} icon" />
          <div class="appText">
            <p class="appName">${escapeHtml(appName)}</p>
            <p class="appSub">Open this post in the app for the full experience</p>
          </div>
        </div>
        <div class="appRight">
          <a class="btn primary" id="bannerCta" href="${escapeHtml(bannerPrimaryHref)}" rel="noopener">${escapeHtml(
            bannerPrimaryLabel
          )}</a>
          <button class="closeX" id="bannerClose" aria-label="Close">✕</button>
        </div>
      </div>
    </div>
  </div>

  <div class="wrap">
    <div class="card">

      <div class="communityBar">
        <a class="communityLeft" href="${escapeHtml(communityUrl)}" rel="noopener" style="text-decoration:none;">
          <img class="cIcon" src="${escapeHtml(communityIcon)}" alt="Community" />
          <div class="communityText">
            <p class="communityName">${escapeHtml(communityName)}</p>
            <p class="communityHandle">${escapeHtml(communityHandle || "Community")}</p>
          </div>
        </a>

        <!-- ✅ Website button moet naar ozvion.com -->
        <a class="btn ghost" href="${escapeHtml(webUrl)}" rel="noopener">Website</a>
      </div>

      ${renderHero(hero.type, hero.url, hero.poster || `${siteUrl}/og-default.png`)}

      <div class="meta">
        <div class="headerRow">
          <div class="who">
            <img class="uAvatar" src="${escapeHtml(userAvatar)}" alt="User" />
            <div class="whoText">
              <div class="line1">
                <span>${escapeHtml(username)}</span>
                <span class="muted">•</span>
                <span class="muted">${escapeHtml(timeAgoText)}</span>
              </div>
              <div class="line2">${escapeHtml("Posted in " + communityName)}</div>
            </div>
          </div>
          <a class="btn ghost" href="${escapeHtml(communityUrl)}" rel="noopener">Community</a>
        </div>

        <h1 class="title">${escapeHtml(title)}</h1>
        <p class="desc">${escapeHtml(post.body || "")}</p>

        <div class="tags">
          ${post.is_nsfw ? `<span class="pill danger">NSFW</span>` : ""}
          ${post.is_spoiler ? `<span class="pill danger">Spoiler</span>` : ""}
          ${post.media_type ? `<span class="pill">${escapeHtml(String(post.media_type))}</span>` : ""}
          ${post.link_url ? `<span class="pill">Link</span>` : ""}
        </div>
      </div>

      <div class="actions">
        <a class="btn primary" href="${escapeHtml(deepLink)}" rel="noopener">Open in app</a>
        ${storeUrl ? `<a class="btn ghost" href="${escapeHtml(storeUrl)}" rel="noopener">Get the app</a>` : ""}

        <!-- ✅ Open Ozvion website moet naar ozvion.com -->
        <a class="btn ghost" href="${escapeHtml(webUrl)}" rel="noopener">Open Ozvion website</a>

        <!-- (optioneel) login ook op web domein -->
        <a class="btn danger" href="${escapeHtml(webUrl + "/login")}" rel="noopener">Login / Sign up</a>
      </div>
    </div>

    <div class="small">Post ID: ${escapeHtml(String(post.id || id))}</div>
  </div>

  <script>
    (function(){
      const banner = document.getElementById('appBanner');
      const closeBtn = document.getElementById('bannerClose');
      if (!banner || !closeBtn) return;

      try{
        if (sessionStorage.getItem('ozvion_banner_closed') === '1') {
          banner.style.display = 'none';
        }
        closeBtn.addEventListener('click', function(){
          banner.style.display = 'none';
          sessionStorage.setItem('ozvion_banner_closed', '1');
        });
      }catch(e){}
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

function renderHero(type, url, poster) {
  if (type === "video") {
    return `
      <div class="hero">
        <video
          controls
          playsinline
          webkit-playsinline
          preload="metadata"
          poster="${escapeHtml(poster)}"
          src="${escapeHtml(url)}"></video>
      </div>
    `;
  }
  return `
    <div class="hero">
      <img src="${escapeHtml(url)}" alt="Post media" loading="eager" />
    </div>
  `;
}

function buildDescription(body, isNsfw, isSpoiler) {
  const tags = [];
  if (isNsfw) tags.push("NSFW");
  if (isSpoiler) tags.push("Spoiler");
  const prefix = tags.length ? `[${tags.join(" · ")}] ` : "";
  const t = body ? stripAndTrim(String(body), 160) : "Bekijk deze post op Ozvion.";
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
