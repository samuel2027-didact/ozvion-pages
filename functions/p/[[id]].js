// functions/p/[[id]].js

export async function onRequest(context) {
  const { params, env, request } = context;

  // 1) Param
  const id = params?.id;
  if (!id) return text("Missing post id", 400);

  // 2) Env checks (hard requirements)
  const supabaseUrl = (env.SUPABASE_URL || "").replace(/\/$/, "");
  if (!supabaseUrl) return text("Missing SUPABASE_URL env var", 500);

  // ✅ Gebruik alleen service role (server-side)
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return text("Missing SUPABASE_SERVICE_ROLE_KEY env var (set as Secret in Cloudflare)", 500);
  }

  const siteUrl = (env.SITE_URL || "https://ozvion.app").replace(/\/$/, "");
  const pageUrl = new URL(request.url);
  const debug = pageUrl.searchParams.get("debug") === "1";

  // 3) Supabase REST query
  const qp = new URLSearchParams();
  qp.set("id", `eq.${id}`);
  qp.set(
    "select",
    "id,title,body,thumbnail_url,media_url,media_type,is_nsfw,is_spoiler,link_url"
  );
  qp.set("limit", "1");

  const apiUrl = `${supabaseUrl}/rest/v1/posts?${qp.toString()}`;

  let res, bodyText, data, post;

  try {
    res = await fetch(apiUrl, {
      method: "GET",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Accept: "application/json",
      },
    });

    bodyText = await res.text();

    // Debug: laat exact zien wat Supabase terugstuurt
    if (debug) {
      return text(
        [
          `Supabase URL: ${supabaseUrl}`,
          `API URL: ${apiUrl}`,
          `Status: ${res.status}`,
          `Body: ${bodyText.slice(0, 2000)}`, // limit
        ].join("\n\n"),
        200
      );
    }

    if (!res.ok) {
      return text(`Supabase error: ${res.status}`, 502);
    }

    data = JSON.parse(bodyText);
    post = data?.[0];
  } catch (e) {
    return text(`Fetch/parse error: ${String(e)}`, 502);
  }

  // 4) Als er geen rij is, geef nette fallback HTML (geen “zwart scherm”)
  if (!post) {
    const html = buildHtml({
      title: "Ozvion",
      description: "Bekijk deze post op Ozvion.",
      image: `${siteUrl}/og-default.png`,
      pageUrl: pageUrl.toString(),
      deepLink: `ozvion://p/${encodeURIComponent(id)}`,
      siteUrl,
    });
    return htmlResponse(html, 200);
  }

  // 5) OG velden uit jouw schema
  const title = post.title ? String(post.title) : "Ozvion";
  const description = buildDescription(post.body, post.is_nsfw, post.is_spoiler);
  const image = pickOgImage(siteUrl, post.thumbnail_url, post.media_url, post.media_type);
  const deepLink = `ozvion://p/${encodeURIComponent(id)}`;

  const html = buildHtml({
    title,
    description,
    image,
    pageUrl: pageUrl.toString(),
    deepLink,
    siteUrl,
  });

  return htmlResponse(html, 200);
}

/* ---------------- Helpers ---------------- */

function htmlResponse(html, status = 200) {
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=60",
    },
  });
}

function text(msg, status = 200) {
  return new Response(msg, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

function buildHtml({ title, description, image, pageUrl, deepLink, siteUrl }) {
  return `<!doctype html>
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

<!-- Probeer app te openen -->
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
}

function pickOgImage(siteUrl, thumbnailUrl, mediaUrl, mediaType) {
  const fallback = `${siteUrl}/og-default.png`;
  if (thumbnailUrl && String(thumbnailUrl).startsWith("http")) return String(thumbnailUrl);
  if (mediaType === "image" && mediaUrl && String(mediaUrl).startsWith("http")) return String(mediaUrl);
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

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
