export async function onRequest(context) {
  const { params, env, request } = context;
  const id = params.id;

  if (!id) return text("Missing post id", 400);

  const supabaseUrl = (env.SUPABASE_URL || "").replace(/\/$/, "");
  const supabaseKey = env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return text("Missing SUPABASE_URL or SUPABASE_ANON_KEY in env", 500);
  }

  // ✅ Jouw echte kolommen
  const select =
    "id,title,body,thumbnail_url,media_url,media_type,is_nsfw,is_spoiler";

  const apiUrl =
    `${supabaseUrl}/rest/v1/posts` +
    `?id=eq.${encodeURIComponent(id)}` +
    `&select=${encodeURIComponent(select)}` +
    `&limit=1`;

  const res = await fetch(apiUrl, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      Accept: "application/json",
    },
  });

  // Handige debug (zet ?debug=1 achter je URL om foutdetails te zien)
  const urlObj = new URL(request.url);
  const debug = urlObj.searchParams.get("debug") === "1";

  if (!res.ok) {
    const errTxt = await safeText(res);
    return text(
      debug
        ? `Supabase error (${res.status}): ${errTxt}\n\nURL:\n${apiUrl}`
        : "Post not found",
      res.status === 404 ? 404 : 500
    );
  }

  const data = await res.json();
  const post = data?.[0];

  if (!post) {
    return text(
      debug ? `No rows returned.\n\nURL:\n${apiUrl}` : "Post not found",
      404
    );
  }

  const title = post.title ?? "Ozvion";
  const description =
    (post.body && String(post.body).slice(0, 180)) ||
    "Bekijk deze post op Ozvion.";

  // Image keuze:
  // - thumbnail_url als die er is
  // - anders media_url (alleen zinvol als het een image is)
  // - anders fallback
  const image =
    post.thumbnail_url ||
    (post.media_type === "image" ? post.media_url : "") ||
    "https://ozvion.app/og-default.png";

  const canonicalUrl = urlObj.toString();

  // Deep link (jouw scheme)
  const deepLink = `ozvion://post/${encodeURIComponent(id)}`;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(title)}</title>

<!-- Open Graph -->
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:image" content="${escapeHtml(image)}" />
<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
<meta property="og:type" content="article" />

<!-- Twitter -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(title)}" />
<meta name="twitter:description" content="${escapeHtml(description)}" />
<meta name="twitter:image" content="${escapeHtml(image)}" />

<!-- Redirect naar app (bots lezen OG tags vóór redirect) -->
<meta http-equiv="refresh" content="0; url=${escapeHtml(deepLink)}" />
</head>
<body style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; margin: 40px;">
<h1>${escapeHtml(title)}</h1>
<p>${escapeHtml(description)}</p>

<p style="margin-top: 24px;">
  <a href="${escapeHtml(deepLink)}"
     style="display:inline-block;padding:12px 16px;border:1px solid #ccc;border-radius:10px;text-decoration:none;">
    Open in app
  </a>
</p>

<p style="margin-top: 12px;">
  <a href="https://ozvion.app" style="color:#666;">Open Ozvion website</a>
</p>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function text(msg, status = 200) {
  return new Response(msg, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

async function safeText(res) {
  try {
    return await res.text();
  } catch {
    return "";
  }
}
