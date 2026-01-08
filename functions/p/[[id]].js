// functions/p/[[id]].js

export async function onRequest(context) {
  const { params, env, request } = context;
  const id = params?.id;

  if (!id) {
    return new Response("Missing post id", { status: 400 });
  }

  const supabaseUrl = (env.SUPABASE_URL || "").replace(/\/$/, "");
  if (!supabaseUrl) {
    return new Response("Missing SUPABASE_URL env var", { status: 500 });
  }

  // ✅ Gebruik SERVICE ROLE voor server-side fetch (bypasst RLS)
  // Zet deze in Cloudflare als Secret: SUPABASE_SERVICE_ROLE_KEY
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = env.SUPABASE_ANON_KEY; // optioneel fallback (niet ideaal)
  const apiKey = serviceRoleKey || anonKey;

  if (!apiKey) {
    return new Response("Missing SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) env var", {
      status: 500,
    });
  }

  // Bouw Supabase REST URL veilig op
  const qp = new URLSearchParams();
  qp.set("id", `eq.${id}`);
  qp.set(
    "select",
    "id,title,body,thumbnail_url,media_url,media_type,is_nsfw,is_spoiler,link_url"
  );
  qp.set("limit", "1");

  const apiUrl = `${supabaseUrl}/rest/v1/posts?${qp.toString()}`;

  const res = await fetch(apiUrl, {
    method: "GET",
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    // Handig voor debug (zonder secrets te lekken)
    return new Response(`Supabase error: ${res.status}`, { status: 502 });
  }

  const data = await res.json();
  const post = data?.[0];

  if (!post) {
    return new Response("Post not found in DB", { status: 404 });
  }

  // OG velden opbouwen uit jouw schema
  const siteUrl = (env.SITE_URL || "https://ozvion.app").replace(/\/$/, "");
  const pageUrl = new URL(request.url).toString();

  const title = post.title ? String(post.title) : "Ozvion";
  const description = buildDescription(post.body, post.is_nsfw, post.is_spoiler);

  const image = pickOgImage(siteUrl, post.thumbnail_url, post.media_url, post.media_type);

  // Deep link (pas aan als jouw scheme anders is)
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
<meta property="og:image" content="${escapeHtml(image)}" />
<meta property="og:url" content="${escapeHtml(pageUrl)}" />
<meta property="og:type" content="article" />

<!-- Twitter -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(title)}" />
<meta name="twitter:description" content="${escapeHtml(description)}" />
<meta name="twitter:image" content="${escapeHtml(image)}" />

<!-- (Optioneel) Probeer app te openen -->
<meta http-equiv="refresh" content="0; url=${deepLink}" />
</head>
<body style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; margin: 40px;">
  <h1 style="margin: 0 0 10px;">${escapeHtml(title)}</h1>
  <p style="margin: 0 0 20px; color: #555;">${escapeHtml(description)}</p>

  <p style="margin-top: 24px;">
    <a href="${deepLink}"
       style="display:inline-block; padding:12px 16px; border:1px solid #ccc; border-radius:10px; text-decoration:none;">
      Open in app
    </a>
  </p>

  <p style="margin-top: 12px;">
    <a href="${siteUrl}" style="color:#555;">Open Ozvion website</a>
  </p>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Kort cachen: OG kan wijzigen
      "Cache-Control": "public, max-age=60",
    },
  });
}

function pickOgImage(siteUrl, thumbnailUrl, mediaUrl, mediaType) {
  const fallback = `${siteUrl}/og-default.png`;

  // Als je een thumbnail_url hebt, altijd die (beste voor OG)
  if (thumbnailUrl && String(thumbnailUrl).startsWith("http")) return String(thumbnailUrl);

  // Als media een image is, gebruik media_url
  if (mediaType === "image" && mediaUrl && String(mediaUrl).startsWith("http")) return String(mediaUrl);

  // Anders fallback
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
  const stripped = s
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (stripped.length <= maxLen) return stripped;
  return stripped.slice(0, maxLen - 1).trimEnd() + "…";
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
