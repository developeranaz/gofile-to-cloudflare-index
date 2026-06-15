=// GoFile Cloudflare Worker - Simple HTTP Index Theme

const CONFIG = {
  GOFILE_API_BASE: "https://api.gofile.io/contents/",
  AUTH_TOKEN: "Bearer THEGOFILETOKEN", // Replace with your API Key
  ROOT_FOLDER_ID: "THEROOTFOLDERID", // Replace your custom or root folder ID here
  AUTHENTICATION: "false", // Replace with "true" or "false"
  OPTIONAL_USER: "oneu", // Replace with your custom username
  OPTIONAL_PASS: "onep", // Replace with your custom password
  CACHE_TTL: 300,
};


const WT_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36";
const WT_LANGUAGE   = "en-US";
const WT_SALT       = "9844d94d963d30";

const ACCOUNT_TOKEN = CONFIG.AUTH_TOKEN.split(" ")[1];

// ── Token generation ─────────────────────────────────────────────────────────

async function generateWT() {
  const timeSlot = Math.floor(Date.now() / 1000 / 14400).toString();
  const raw      = `${WT_USER_AGENT}::${WT_LANGUAGE}::${ACCOUNT_TOKEN}::${timeSlot}::${WT_SALT}`;
  const encoded  = new TextEncoder().encode(raw);
  const hashBuf  = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hashBuf))
              .map(b => b.toString(16).padStart(2, "0"))
              .join("");
}

// ── API ───────────────────────────────────────────────────────────────────────

const apiCache = new Map();

async function fetchFileList(folderId) {
  const cacheKey = `folder_${folderId}`;
  const cached   = apiCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CONFIG.CACHE_TTL * 1000) {
    return cached.data;
  }

  const xwt = await generateWT();

  const response = await fetch(
    `${CONFIG.GOFILE_API_BASE}${folderId}?contentFilter=&page=1&pageSize=1000&sortField=createTime&sortDirection=-1`,
    {
      headers: {
        "Accept":             "*/*",
        "Accept-Language":    WT_LANGUAGE,
        "Authorization":      CONFIG.AUTH_TOKEN,
        "Origin":             "https://gofile.io",
        "Referer":            "https://gofile.io/",
        "User-Agent":         WT_USER_AGENT,
        "X-BL":               WT_LANGUAGE,
        "X-Website-Token":    xwt,
        "sec-ch-ua":          '"Chromium";v="146", "Not-A.Brand";v="24", "Brave";v="146"',
        "sec-ch-ua-mobile":   "?0",
        "sec-ch-ua-platform": '"Windows"',
        "sec-fetch-dest":     "empty",
        "sec-fetch-mode":     "cors",
        "sec-fetch-site":     "same-site",
      },
      cf: { cacheTtl: CONFIG.CACHE_TTL }
    }
  );

  if (!response.ok) throw new Error(`API request failed: ${response.status}`);

  const data = await response.json();
  if (data.status !== "ok") throw new Error(`API error: ${data.message || "Unknown error"}`);

  apiCache.set(cacheKey, { data, timestamp: Date.now() });
  return data;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatFileSize(bytes) {
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  if (bytes === 0) return "0 Bytes";
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(2) + " " + sizes[i];
}

function formatModTime(timestamp) {
  return new Date(timestamp * 1000).toISOString().replace("T", " ").slice(0, 19);
}

function checkAuth(request) {
  if (CONFIG.AUTHENTICATION !== "true") return true;
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Basic ")) return false;
  const credentials = atob(authHeader.split(" ")[1]);
  const [username, password] = credentials.split(":");
  return username === CONFIG.OPTIONAL_USER && password === CONFIG.OPTIONAL_PASS;
}

// ── HTML generation ───────────────────────────────────────────────────────────

function generateHTML(json, folderId) {
  const children = Object.values(json.data.children || {});
  const folders  = children.filter(f => f.type === "folder");
  const files    = children.filter(f => f.type !== "folder");

  const isRoot = folderId === CONFIG.ROOT_FOLDER_ID;
  const folderName = json.data.name || folderId;

  const parentRow = (!isRoot && json.data.parentFolder)
    ? `<tr>
        <td><a href="/?folder=${json.data.parentFolder}">../</a></td>
        <td>-</td>
        <td>-</td>
        <td>-</td>
      </tr>`
    : "";

  const folderRows = folders.map(folder => `
    <tr>
      <td><a href="/?folder=${folder.id}">${folder.name}/</a></td>
      <td>${formatModTime(folder.modTime)}</td>
      <td>-</td>
      <td>-</td>
    </tr>`).join("");

  const fileRows = files.map(file => {
    const dlUrl = `/download/${encodeURIComponent(file.name)}?folder=${folderId}`;
    return `
    <tr>
      <td><a href="${dlUrl}">${file.name}</a></td>
      <td>${formatModTime(file.modTime)}</td>
      <td>${formatFileSize(file.size)}</td>
      <td>${file.downloadCount || 0}</td>
    </tr>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Index of /${folderName}</title>
  <style>
    body {
      font-family: monospace;
      background: #fff;
      color: #000;
      padding: 20px;
    }
    h1 {
      font-size: 1em;
      margin-bottom: 10px;
    }
    hr {
      border: none;
      border-top: 1px solid #000;
      margin: 8px 0;
    }
    a {
      color: #00e;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
    table {
      width: 100%;
      border-spacing: 0;
    }
    th, td {
      padding: 2px 16px 2px 0;
      text-align: left;
      white-space: nowrap;
    }
    td:first-child, th:first-child {
      width: 60%;
      white-space: normal;
      word-break: break-all;
    }
    th {
      font-weight: bold;
    }
  </style>
</head>
<body>
  <h1>Index of /${folderName}</h1>
  <hr>
  <table>
    <thead>
      <tr>
        <th>Name</th>
        <th>Last Modified</th>
        <th>Size</th>
        <th>Downloads</th>
      </tr>
    </thead>
    <tbody>
      ${parentRow}
      ${folderRows}
      ${fileRows}
    </tbody>
  </table>
  <hr>
  <small>GoFile Index &mdash; ${children.length} item(s)</small>
</body>
</html>`;
}

// ── Download stream ───────────────────────────────────────────────────────────

async function handleStreamDownload(file, request) {
  const range = request.headers.get("Range");

  const headers = {
    "Accept":          "*/*",
    "Referer":         "https://gofile.io/",
    "User-Agent":      request.headers.get("User-Agent") || WT_USER_AGENT,
    "Cookie":          `accountToken=${ACCOUNT_TOKEN}`,
    "Accept-Encoding": "identity",
    "Connection":      "keep-alive",
  };

  if (range) headers["Range"] = range;

  const fileResponse = await fetch(file.link, {
    headers,
    cf: { cacheTtl: -1, polish: "off" }
  });

  if (!fileResponse.ok && fileResponse.status !== 206) {
    throw new Error(`Upstream error: ${fileResponse.status}`);
  }

  const responseHeaders = new Headers();
  ["content-length", "content-range", "accept-ranges", "etag", "last-modified", "content-type"]
    .forEach(h => {
      const val = fileResponse.headers.get(h);
      if (val) responseHeaders.set(h, val);
    });

  responseHeaders.set("Content-Disposition",          `attachment; filename="${encodeURIComponent(file.name)}"`);
  responseHeaders.set("Accept-Ranges",                "bytes");
  responseHeaders.set("Cache-Control",                "no-cache, no-store, must-revalidate");
  responseHeaders.set("Access-Control-Allow-Origin",  "*");
  responseHeaders.set("Access-Control-Expose-Headers","Content-Length, Content-Range, ETag");

  return new Response(fileResponse.body, {
    status: fileResponse.status,
    statusText: fileResponse.statusText,
    headers: responseHeaders,
  });
}

// ── Main handler ──────────────────────────────────────────────────────────────

async function handleRequest(event) {
  const request  = event.request;
  const url      = new URL(request.url);
  const path     = url.pathname;
  const folderId = url.searchParams.get("folder") || CONFIG.ROOT_FOLDER_ID;

  // CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin":  "*",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
        "Access-Control-Allow-Headers": "Range, Authorization",
        "Access-Control-Expose-Headers":"Content-Length, Content-Range, ETag, Accept-Ranges",
      }
    });
  }

  // Basic auth gate (index only)
  if (path === "/" && CONFIG.AUTHENTICATION === "true") {
    if (!checkAuth(request)) {
      return new Response("Unauthorized", {
        status: 401,
        headers: {
          "WWW-Authenticate": 'Basic realm="GoFile Index"',
          "Content-Type":     "text/plain",
        }
      });
    }
  }

  // Index page
  if (path === "/") {
    let json;
    try {
      json = await fetchFileList(folderId);
    } catch (err) {
      return new Response(`Error: ${err.message}`, { status: 500, headers: { "Content-Type": "text/plain" } });
    }
    return new Response(generateHTML(json, folderId), {
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" }
    });
  }

  // File download
  if (path.startsWith("/download/")) {
    const fileName = decodeURIComponent(path.replace("/download/", ""));
    let json;
    try {
      json = await fetchFileList(folderId);
    } catch (err) {
      return new Response(`Error: ${err.message}`, { status: 500 });
    }
    const file = Object.values(json.data.children || {}).find(f => f.name === fileName);
    if (!file) return new Response("File not found", { status: 404 });
    try {
      return await handleStreamDownload(file, request);
    } catch (err) {
      return new Response(`Download error: ${err.message}`, { status: 502 });
    }
  }

  return new Response("Not Found", { status: 404 });
}

addEventListener("fetch", event => {
  event.respondWith(handleRequest(event));
});
