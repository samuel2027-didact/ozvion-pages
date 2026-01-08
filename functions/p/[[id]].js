export async function onRequest(context) {
  const { params, env, request } = context;
  const id = params.id;

  if (!id) {
    return new Response("Missing post id", { status: 400 });
  }

  const supabaseUrl = env.SUPABASE_URL;
  const supabaseKey = env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return new Response("Server misconfigured (missing SUPABASE_URL / SUPABASE_ANON_KEY)", {
      status: 500,
    });
  }

  // We gebruiken jouw bestaande kolommen: title + body
  const res = await fetch(
    `${supabaseUrl}/rest/v1/posts?id=eq.${encodeURIComponent(id)}&select=title,body`,
    {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    }
  );

  if (!res.ok) {
    return new Response("Post not found", { status: 404 });
  }

  const data = await res.json();
  const post = data?.[0];

  if (!post) {
    return new Response("Post not found", { status: 404 });
  }

  const title = post.title ?? "Ozvion";
  const body = post.body ?? "";
  const description =
    body.length > 0 ? body.slice(0, 160) : "Bekijk deze post op Ozvion.";

  // Voor nu één standaard OG image (later kun je per post og_image toevoegen)
  const image = "https://ozvion.app/og-default.png";
  const url = new URL(request.url).toString();

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>

<!-- Open Graph -->
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:image" content="${image}" />
<meta property="og:url" content="${escapeHtml(url)}" />
<meta property="og:type" content="article" />

<!-- Twitter -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(title)}" />
<meta name="twitter:description" content="${escapeHtml(description)}" />
<meta name="twitter:image" content="${image}" />

</head>
<body style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; margin: 40px;">
  <h1 style="margin: 0 0 12px 0;">${escapeHtml(title)}</h1>
  <p style="margin: 0 0 24px 0; color: #444;">${escapeHtml(description)}</p>

  <p style="margin: 0 0 12px 0;">
    <a href="ozvion://post/${encodeURIComponent(id)}"
       style="display:inline-block;padding:12px 16px;border:1px solid #ccc;border-radius:10px;text-decoration:none;">
      Open in app
    </a>
  </p>

  <p style="margin: 0;">
    <a href="https://ozvion.app" style="color:#555;">Open Ozvion website</a>
  </p>

  <!--
    Belangrijk:
    - iOS Universal Links werkt later via apple-app-site-association.
    - Tot die tijd is deze knop + custom scheme prima.
  -->
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // 5 min cache is prima voor OG; later kun je stale-while-revalidate doen
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
