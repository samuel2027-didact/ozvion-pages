// functions/p/[[id]].js

export async function onRequest(context) {
  const { params, env, request } = context;
  const id = params?.id;

  if (!id) {
    return new Response("Missing post id", { status: 400 });
  }

  const supabaseUrl = env.SUPABASE_URL;          // bv: https://xxxx.supabase.co
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY; // voorkeur: service role

  if (!supabaseUrl || !supabaseKey) {
    return new Response("Server misconfigured: missing SUPABASE_URL or key", {
      status: 500,
    });
  }

  // ✅ Gebruik ECHTE kolommen uit jouw posts tabel (title, body, thumbnail_url, media_url, media_type, etc.)
  const apiUrl =
    `${supabaseUrl}/rest/v1/posts` +
    `?id=eq.${encodeURIComponent(id)}` +
    `&select=id,title,body,thumbnail_url,media_url,media_type,is_nsfw,is_spoiler` +
    `&limit=1`;

  const res = await fetch(apiUrl, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      Accept: "application/json",
    },
  });

  // Debugbaar: als Supabase faalt, laat fout zien
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    return new Response(`Supabase error (${res.status}): ${txt}`, { status: 500 });
  }

  const data = await res.json();
  const post = data?.[0];

  // Als geen rij gevonden -> duidelijke melding
  if (!post) {
    return new Response("Post not found in DB", { status: 404 });
  }

  const title = post?.title ?? "Ozvion";
  const description =
    (post?.body ? String(post.body).slice(0, 160) : null) ??
    "Bekijk deze post op Ozvion.";

  // thumbnail_url heeft voorkeur, anders media_url, anders default
  const image =
    post?.thumbnail_url ||
    post?.media_url ||
    "https://ozvion.app/og-default.png";

  const url = new URL(request.url).toString();

  // Deep link: pas dit aan als jouw scheme anders is
  const appDeepLink = `ozvion://post/${encodeURIComponent(id)}`;

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
<meta property="og:url" content="${escapeHtml(url)}" />
<meta property="og:type" content="article" />

<!-- Twitter -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(title)}" />
<meta name="twitter:description" content="${escapeHtml(description)}" />
<meta name="twitter:image" content="${escapeHtml(image)}" />

<!-- iOS/Android fallback: probeer app te openen -->
<meta http-equiv="refresh" content="0; url=${escapeHtml(appDeepLink)}" />
</head>
<body style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; margin: 40px;">
  <h1 style="margin: 0 0 8px;">${escapeHtml(title)}</h1>
  <p style="margin: 0 0 24px; color: #555;">${escapeHtml(description)}</p>

  <p style="margin: 0 0 12px;">
    <a href="${escapeHtml(appDeepLink)}"
       style="display:inline-block;padding:12px 16px;border:1px solid #ccc;border-radius:10px;text-decoration:none;">
      Open in app
    </a>
  </p>

  <p style="margin: 0;">
    <a href="https://ozvion.app" style="color:#555;">Open Ozvion website</a>
  </p>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // OG mag best gecached worden; later tunen met s-maxage/stale-while-revalidate
      "Cache-Control": "public, max-age=300",
    },
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
