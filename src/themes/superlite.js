// GoFile Cloudflare Worker – Ultra Minimal UI (2026-03-31)
// All HTML is in a single template string. No CSS, no frameworks.
// Shared folder input and search filter are included.

const CONFIG = {
  GOFILE_API_BASE: "https://api.gofile.io/contents/",
  AUTH_TOKEN: "Bearer THEGOFILETOKEN", // Replace with your API Key
  ROOT_FOLDER_ID: "THEROOTFOLDERID", // Replace your custom or root folder ID here
  AUTHENTICATION: "false", // Replace with "true" or "false"
  OPTIONAL_USER: "oneu", // Replace with your custom username
  OPTIONAL_PASS: "onep", // Replace with your custom password

  CACHE_TTL: 300,
  DEFAULT_CHUNK_SIZE: 2 * 1024 * 1024,
  MAX_CHUNK_SIZE: 16 * 1024 * 1024,
  MIN_CHUNK_SIZE: 256 * 1024,
  MAX_CONCURRENT_CONNECTIONS: 8,
  MAX_RETRIES: 5,
  RETRY_DELAY_BASE: 1000,
  WORKER_CPU_TIMEOUT_MS: 50000,
  WORKER_MEMORY_LIMIT_MB: 128
};

// ─── X‑Website‑Token constants ─────────────────────────────────────────────
const WT_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36";
const WT_LANGUAGE   = "en-US";
const WT_SALT       = "5d4f7g8sd45fsd";
const ACCOUNT_TOKEN = CONFIG.AUTH_TOKEN.split(" ")[1];

// ─── HTML Template – NO CSS, only raw HTML ─────────────────────────────────
const UI_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GoFile Index – {{FOLDER_NAME}}</title>
</head>
<body>
  <h1>📁 {{FOLDER_NAME}}</h1>
  <p>Folder: {{FOLDER_CODE}}</p>
  <p>{{ITEM_COUNT}} items{{#TOTAL_SIZE}} • {{TOTAL_SIZE}}{{/TOTAL_SIZE}} • {{DOWNLOAD_COUNT}} downloads</p>
  {{BACK_LINK}}
  <hr>
  <div>
    <input type="text" id="search" placeholder="Filter files/folders...">
    <label><input type="checkbox" id="caseSensitive"> Case‑sensitive</label>
  </div>
  <table border="1" cellpadding="5" cellspacing="0">
    <thead>
      <tr><th>Name</th><th>Type</th><th>Size</th><th>Modified</th><th></th></tr>
    </thead>
    <tbody>
      {{TABLE_ROWS}}
    </tbody>
  </table>
  <hr>
  <div>
    <input type="text" id="sharedFolderInput" placeholder="Folder ID or URL">
    <button onclick="openSharedFolder()">Open Shared Folder</button>
  </div>
  <script>
    function openSharedFolder() {
      let input = document.getElementById('sharedFolderInput').value.trim();
      if (!input) return;
      let folderId = input.includes('gofile.io/d/') ? input.split('/d/')[1].split('/')[0] : input;
      window.location.href = '/?folder=' + encodeURIComponent(folderId);
    }
    const searchInput = document.getElementById('search');
    const caseCheck = document.getElementById('caseSensitive');
    const rows = document.querySelectorAll('#file-table tbody tr');
    function filterRows() {
      let term = searchInput.value;
      if (!caseCheck.checked) term = term.toLowerCase();
      rows.forEach(row => {
        let text = row.textContent;
        if (!caseCheck.checked) text = text.toLowerCase();
        row.style.display = text.includes(term) ? '' : 'none';
      });
    }
    searchInput.addEventListener('input', filterRows);
    caseCheck.addEventListener('change', filterRows);
  </script>
</body>
</html>`;

// ─── Helper: generate Website Token  ────────────────────────────
async function generateWT() {
  try {
    const timeSlot = Math.floor(Date.now() / 1000 / 14400).toString();
    const raw      = `${WT_USER_AGENT}::${WT_LANGUAGE}::${ACCOUNT_TOKEN}::${timeSlot}::${WT_SALT}`;
    const encoded  = new TextEncoder().encode(raw);
    const hashBuf  = await crypto.subtle.digest("SHA-256", encoded);
    return Array.from(new Uint8Array(hashBuf))
                .map(b => b.toString(16).padStart(2, "0"))
                .join("");
  } catch (err) {
    console.error("generateWT failed:", err);
    throw new Error(`Token generation error: ${err.message}`);
  }
}

// ─── API cache  ─────────────────────────────────────────────────
const apiCache = new Map();

async function fetchFileList(folderId) {
  const cacheKey = `folder_${folderId}`;
  const cached = apiCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CONFIG.CACHE_TTL * 1000) {
    return cached.data;
  }

  try {
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

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    if (data.status !== "ok") {
      throw new Error(`API error: ${data.message || "Unknown error"}`);
    }

    apiCache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  } catch (error) {
    console.error("Fetch file list error:", error);
    return { status: "error", message: error.message };
  }
}

// ─── Download token  ────────────────────────────────────────────
async function generateDownloadToken(file) {
  return {
    url: file.link,
    cookie: `accountToken=${ACCOUNT_TOKEN}`,
    filename: file.name,
    size: file.size,
    supportsRange: true
  };
}

// ─── Stream download  ───────────────────────────────────────────
async function handleStreamDownload(file, request) {
  const range = request.headers.get("Range");

  const headers = {
    "Accept":          "*/*",
    "Referer":         "https://gofile.io/",
    "User-Agent":      request.headers.get("User-Agent") || "Mozilla/5.0",
    "Cookie":          `accountToken=${ACCOUNT_TOKEN}`,
    "Accept-Encoding": "identity",
    "Connection":      "keep-alive"
  };

  if (range) headers["Range"] = range;

  const fileResponse = await fetch(file.link, {
    headers,
    cf: {
      cacheTtl: -1,
      polish: "off",
      minify: { javascript: false, css: false, html: false }
    }
  });

  if (!fileResponse.ok && fileResponse.status !== 206) {
    throw new Error(`Download error: ${fileResponse.status}`);
  }

  const responseHeaders = new Headers();
  ["content-length","content-range","accept-ranges","etag","last-modified","content-type"]
    .forEach(h => {
      const val = fileResponse.headers.get(h);
      if (val) responseHeaders.set(h, val);
    });

  responseHeaders.set("Content-Disposition",  `attachment; filename="${encodeURIComponent(file.name)}"`);
  responseHeaders.set("Accept-Ranges",         "bytes");
  responseHeaders.set("Cache-Control",         "no-cache, no-store, must-revalidate");
  responseHeaders.set("Access-Control-Allow-Origin",   "*");
  responseHeaders.set("Access-Control-Expose-Headers", "Content-Length, Content-Range, ETag");

  return new Response(fileResponse.body, {
    status: fileResponse.status,
    statusText: fileResponse.statusText,
    headers: responseHeaders
  });
}

// ─── Helper formatting  ─────────────────────────────────────────
function formatFileSize(bytes) {
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  if (bytes === 0) return "0 Bytes";
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(2) + " " + sizes[i];
}

function formatModTime(timestamp) {
  return new Date(timestamp * 1000).toLocaleString();
}

function getFileIcon(name) {
  const ext = name.split('.').pop().toLowerCase();
  const icons = {
    video:    ['mp4', 'mkv', 'avi', 'mov', 'webm'],
    image:    ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    archive:  ['zip', 'rar', '7z', 'tar', 'gz'],
    document: ['pdf', 'doc', 'docx'],
    code:     ['txt', 'json', 'xml', 'html', 'css', 'js', 'py'],
    audio:    ['mp3', 'wav', 'flac', 'aac']
  };
  if (icons.video.includes(ext))    return '🎥';
  if (icons.image.includes(ext))    return '🖼️';
  if (icons.archive.includes(ext))  return '📦';
  if (icons.document.includes(ext)) return '📄';
  if (icons.code.includes(ext))     return '📝';
  if (icons.audio.includes(ext))    return '🎵';
  return '📁';
}

function getMimeType(name) {
  const ext = name.split('.').pop().toLowerCase();
  const mimeTypes = {
    'jpg':'image/jpeg','jpeg':'image/jpeg','png':'image/png','gif':'image/gif',
    'webp':'image/webp','mp4':'video/mp4','mkv':'video/x-matroska',
    'avi':'video/x-msvideo','mov':'video/quicktime','webm':'video/webm',
    'mp3':'audio/mpeg','wav':'audio/wav','flac':'audio/flac',
    'pdf':'application/pdf','zip':'application/zip',
    'rar':'application/x-rar-compressed','txt':'text/plain',
    'json':'application/json','xml':'application/xml',
    'html':'text/html','css':'text/css','js':'application/javascript'
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

function checkAuth(request) {
  if (CONFIG.AUTHENTICATION !== "true") return true;
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Basic ")) return false;
  const credentials = atob(authHeader.split(" ")[1]);
  const [username, password] = credentials.split(":");
  return username === CONFIG.OPTIONAL_USER && password === CONFIG.OPTIONAL_PASS;
}

// ─── Centralised HTML generation (uses UI_TEMPLATE) ─────────────────────────
function generateHTML(json, folderId) {
  const children = Object.values(json.data.children || {});
  const folders  = children.filter(f => f.type === "folder");
  const files    = children.filter(f => f.type !== "folder");

  let tableRows = "";

  for (const folder of folders) {
    tableRows += `
      <tr>
        <td><span>📁</span> <a href="/?folder=${folder.id}">${escapeHtml(folder.name)}</a></td>
        <td>Folder</td>
        <td>-</td>
        <td>${formatModTime(folder.modTime)}</td>
        <td></td>
      </tr>`;
  }

  for (const file of files) {
    const downloadUrl = `/download/${encodeURIComponent(file.name)}?folder=${folderId}`;
    tableRows += `
      <tr>
        <td><span>${getFileIcon(file.name)}</span> <a href="${downloadUrl}">${escapeHtml(file.name)}</a></td>
        <td>${getMimeType(file.name).split('/')[1]?.toUpperCase() || 'FILE'}</td>
        <td>${formatFileSize(file.size)}</td>
        <td>${formatModTime(file.modTime)}</td>
        <td><a href="${downloadUrl}">Download</a></td>
      </tr>`;
  }

  const backLink = (folderId !== CONFIG.ROOT_FOLDER_ID && json.data.parentFolder)
    ? `<p><a href="/?folder=${json.data.parentFolder}">← Back to Parent Folder</a></p>`
    : "";

  const totalSize = json.data.totalSize ? formatFileSize(json.data.totalSize) : null;

  let html = UI_TEMPLATE
    .replace(/\{\{FOLDER_NAME\}\}/g, escapeHtml(json.data.name || folderId))
    .replace(/\{\{FOLDER_CODE\}\}/g, escapeHtml(json.data.code || folderId))
    .replace(/\{\{ITEM_COUNT\}\}/g, children.length)
    .replace(/\{\{DOWNLOAD_COUNT\}\}/g, json.data.totalDownloadCount || 0)
    .replace(/\{\{BACK_LINK\}\}/g, backLink)
    .replace(/\{\{TABLE_ROWS\}\}/g, tableRows);

  if (!totalSize) {
    html = html.replace(/\{\{#TOTAL_SIZE\}\}.*\{\{\/TOTAL_SIZE\}\}/g, "");
  } else {
    html = html.replace(/\{\{#TOTAL_SIZE\}\}(.*?)\{\{\/TOTAL_SIZE\}\}/g, ` • ${totalSize}`);
  }

  // Add a dummy id to the table so the JavaScript can find rows
  html = html.replace(/<tbody>/, '<tbody id="file-table-body">');
  // Adjust the JavaScript to use the new id
  html = html.replace(/rows = document\.querySelectorAll\('#file-table tbody tr'\)/, "rows = document.querySelectorAll('#file-table-body tr')");

  return html;
}

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}

// ─── Request handler  ───────────────────────────────────────────
async function handleRequest(event) {
  const request = event.request;
  const url     = new URL(request.url);
  const path    = url.pathname;
  const folderId = url.searchParams.get("folder") || CONFIG.ROOT_FOLDER_ID;

  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin":  "*",
        "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Range, Content-Type, Authorization",
        "Access-Control-Expose-Headers":"Content-Length, Content-Range, ETag, Accept-Ranges"
      }
    });
  }

  if (path === "/" && !url.searchParams.get("folder") && CONFIG.AUTHENTICATION === "true") {
    if (!checkAuth(request)) {
      return new Response("Unauthorized", {
        status: 401,
        headers: { "WWW-Authenticate": 'Basic realm="GoFile Index"', "Content-Type": "text/plain" }
      });
    }
  }

  if (path === "/api/download-token") {
    const fileId       = url.searchParams.get("fileId");
    const folderIdParam = url.searchParams.get("folder") || CONFIG.ROOT_FOLDER_ID;
    if (!fileId) return new Response(JSON.stringify({ error: "Missing fileId" }), { status: 400, headers: { "Content-Type": "application/json" } });
    const json = await fetchFileList(folderIdParam);
    if (json.status !== "ok") return new Response(JSON.stringify({ error: "Failed to fetch file list" }), { status: 500, headers: { "Content-Type": "application/json" } });
    const file = Object.values(json.data.children || {}).find(f => f.id === fileId);
    if (!file) return new Response(JSON.stringify({ error: "File not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
    const token = await generateDownloadToken(file);
    return new Response(JSON.stringify(token), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
  }

  if (path === "/") {
    const json = await fetchFileList(folderId);
    if (json.status !== "ok") return new Response(`Error: ${json.message || "Failed to fetch files"}`, { status: 500, headers: { "Content-Type": "text/plain" } });
    return new Response(generateHTML(json, folderId), { headers: { "Content-Type": "text/html", "Cache-Control": "no-cache" } });
  }

  if (path.startsWith("/download/")) {
    const fileName = decodeURIComponent(path.replace("/download/", ""));
    const json     = await fetchFileList(folderId);
    if (json.status !== "ok") return new Response("File list error", { status: 500 });
    const file = Object.values(json.data.children || {}).find(f => f.name === fileName);
    if (!file) return new Response("File not found", { status: 404 });
    return handleStreamDownload(file, request);
  }

  return new Response("Not Found", { status: 404 });
}

addEventListener("fetch", event => {
  event.respondWith(handleRequest(event));
});
