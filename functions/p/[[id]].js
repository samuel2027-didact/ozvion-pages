// functions/p/[[id]].js

export async function onRequest(context) {
  const { params, env, request } = context;

  // id kan bij Pages Functions soms undefined of array zijn
  const rawId = params?.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  if (!id) return new Response("Missing post id", { status: 400 });

  // (optioneel) simpele UUID check
  const uuidRe =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(id)) return new Response("Invalid post id", { status: 400 });

  const supabaseUrl = (env.SUPABASE_URL || "").replace(/\/$/, "");
  if (!supabaseUrl) return new Response("Missing SUPABASE_URL env var", { status: 500 });

  // ✅ Alleen service role gebruiken op de server (Cloudflare Secret)
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return new Response("Missing SUPABASE_SERVICE_ROLE_KEY env var", { status: 500 });
  }

  const qp = new URLSearchParams();
  qp.set("id", `eq.${id}`);
  qp.set(
    "select",
    "id,title,body,thumbnail_url,media_url,media_type,is_nsfw,is_spoiler,link_url,created_at"
  );
  qp.set("limit", "1");

  const apiUrl = `${supabaseUrl}/rest/v1/posts?${qp.toString()}`;

  const res = await fetch(apiUrl, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Accept: "application/json",
    },
  });

  const debug = new URL(request.url).searchParams.get("debug") === "1";

  // Debug output (geen secrets)
  if (debug) {
    const text = await res.text();
    return new Response(
      JSON.stringify(
        {
          id,
          supabaseUrl,
          apiUrl,
          status: res.status,
          body: safeJson(text),
        },
        null,
        2
      ),
      { headers: { "Content-Type": "application/json; charset=utf-8" } }
    );
  }

  if (!res.ok) return new Response(`Supabase error: ${res.status}`, { status: 502 });

  const data = await res.json();
  const post = data?.[0];
  if (!post) return new Response("Post not found in DB", { status: 404 });

  const siteUrl = (env.SITE_URL || "https://ozvion.app").replace(/\/$/, "");
  const pageUrl = new URL(request.url).toString();

  const title = post.title ? String(post.title) : "Ozvion";
  const description = buildDescription(post.body, post.is_nsfw, post.is_spoiler);

  const ogImage = pickOgImage(siteUrl, post.thumbnail_url, post.media_url, post.media_type);

  const mediaHtml = buildMediaHtml(post.media_type, post.media_url, post.thumbnail_url);

  // Deep link (alleen knop — géén auto-redirect, anders breek je video/UX in webviews)
  const deepLink = `ozvion://p/${encodeURIComponent(id)}`;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
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

<style>
  body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; margin: 24px; background: #fff; color:#111; }
  .wrap { max-width: 720px; margin: 0 auto; }
  .title { font-size: 42px; font-weight: 800; margin: 0 0 8px; }
  .desc { color:#555; margin: 0 0 18px; line-height: 1.4; }
  .media { margin: 18px 0 18px; border-radius: 14px; overflow: hidden; background:#000; }
  video, img { width: 100%; height: auto; display:block; }
  .btnrow { display:flex; gap:12px; flex-wrap:wrap; margin-top: 14px; }
  .btn { display:inline-block; padding:12px 16px; border:1px solid #ddd; border-radius:12px; text-decoration:none; color:#111; background:#fff; }
  .btn.primary { border-color:#111; }
  .meta { margin-top: 14px; color:#777; font-size: 13px; }
  .link { margin-top: 10px; }
</style>
</head>
<body>
  <div class="wrap">
    <h1 class="title">${escapeHtml(title)}</h1>
    <p class="desc">${escapeHtml(description)}</p>

    ${mediaHtml}

    ${post.link_url ? `<div class="link"><a class="btn" href="${escapeHtml(safeHttpUrl(post.link_url) || siteUrl)}" rel="noopener">Open link</a></div>` : ""}

    <div class="btnrow">
      <a class="btn primary" href="${deepLink}">Open in app</a>
      <a class="btn" href="${siteUrl}">Open Ozvion website</a>
      <a class="btn" href="${siteUrl}/login">Login / Sign up</a>
    </div>

    <div class="meta">Post ID: ${escapeHtml(String(post.id))}</div>
  </div>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=60",
    },
  });
}

function buildMediaHtml(mediaType, mediaUrl, thumbnailUrl) {
  const mUrl = safeHttpUrl(mediaUrl);
  const tUrl = safeHttpUrl(thumbnailUrl);

  if (mediaType === "video" && mUrl) {
    const poster = tUrl ? ` poster="${escapeHtml(tUrl)}"` : "";
    return `
      <div class="media">
        <video controls playsinline${poster}>
          <source src="${escapeHtml(mUrl)}" />
        </video>
      </div>
    `;
  }

  if (mediaType === "image" && mUrl) {
    return `
      <div class="media">
        <img src="${escapeHtml(mUrl)}" alt="" />
      </div>
    `;
  }

  return ""; // geen media
}

function pickOgImage(siteUrl, thumbnailUrl, mediaUrl, mediaType) {
  const fallback = `${siteUrl}/og-default.png`;

  const t = safeHttpUrl(thumbnailUrl);
  if (t) return t;

  // OG previews willen vrijwel altijd een image (ook bij video)
  if (mediaType === "image") {
    const m = safeHttpUrl(mediaUrl);
    if (m) return m;
  }

  return fallback;
}

function buildDescription(body, isNsfw, isSpoiler) {
  const tags = [];
  if (isNsfw) tags.push("NSFW");
  if (isSpoiler) tags.push("Spoiler");
  const prefix = tags.length ? `[${tags.join(" · ")}] ` : "";
  const text = body ? stripAndTrim(String(body), 160) : "Bekijk deze post op Ozvion.";
  return prefix + text;
}

function stripAndTrim(s, maxLen) {
  const stripped = s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  if (stripped.length <= maxLen) return stripped;
  return stripped.slice(0, maxLen - 1).trimEnd() + "…";
}

function safeHttpUrl(u) {
  const s = (u ?? "").toString().trim();
  if (!s) return null;
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  return null;
}

function safeJson(text) {
  try { return JSON.parse(text); } catch { return text; }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
