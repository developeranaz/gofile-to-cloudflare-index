// Dark default Theme edited on 01032026 

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

const apiCache = new Map();

async function fetchFileList(folderId) {
  const cacheKey = `folder_${folderId}`;
  const cached = apiCache.get(cacheKey);

  if (cached && (Date.now() - cached.timestamp) < CONFIG.CACHE_TTL * 1000) {
    return cached.data;
  }

  try {
    const response = await fetch(
      `${CONFIG.GOFILE_API_BASE}${folderId}?contentFilter=&page=1&pageSize=1000&sortField=createTime&sortDirection=-1`,
      {
        headers: {
          "Authorization": CONFIG.AUTH_TOKEN,
          "x-website-token": "4fd6sg89d7s6",
          "Accept": "application/json"
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

async function generateDownloadToken(file) {

  return {
    url: file.link,
    cookie: `accountToken=${CONFIG.AUTH_TOKEN.split(" ")[1]}`,
    filename: file.name,
    size: file.size,
    supportsRange: true
  };
}

async function handleStreamDownload(file, request) {
  const range = request.headers.get("Range");

  const headers = {
    "Accept": "*/*",
    "Referer": "https://gofile.io/",
    "User-Agent": request.headers.get("User-Agent") || "Mozilla/5.0",
    "Cookie": `accountToken=${CONFIG.AUTH_TOKEN.split(" ")[1]}`,
    "Accept-Encoding": "identity", 

    "Connection": "keep-alive"
  };

  if (range) {
    headers["Range"] = range;
  }

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

  const headersToCopy = [
    "content-length", "content-range", "accept-ranges", 
    "etag", "last-modified", "content-type"
  ];
  headersToCopy.forEach(h => {
    const val = fileResponse.headers.get(h);
    if (val) responseHeaders.set(h, val);
  });

  responseHeaders.set("Content-Disposition", `attachment; filename="${encodeURIComponent(file.name)}"`);
  responseHeaders.set("Accept-Ranges", "bytes");
  responseHeaders.set("Cache-Control", "no-cache, no-store, must-revalidate");
  responseHeaders.set("Access-Control-Allow-Origin", "*");
  responseHeaders.set("Access-Control-Expose-Headers", "Content-Length, Content-Range, ETag");

  return new Response(fileResponse.body, {
    status: fileResponse.status,
    statusText: fileResponse.statusText,
    headers: responseHeaders
  });
}

async function checkRangeSupport(url) {
  try {
    const checkResponse = await fetch(url, {
      method: "HEAD",
      headers: {
        "Cookie": `accountToken=${CONFIG.AUTH_TOKEN.split(" ")[1]}`,
        "Referer": "https://gofile.io/"
      }
    });

    return checkResponse.headers.get("Accept-Ranges") === "bytes";
  } catch {
    return false;
  }
}

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
    video: ['mp4', 'mkv', 'avi', 'mov', 'webm'],
    image: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    archive: ['zip', 'rar', '7z', 'tar', 'gz'],
    document: ['pdf', 'doc', 'docx'],
    code: ['txt', 'json', 'xml', 'html', 'css', 'js', 'py'],
    audio: ['mp3', 'wav', 'flac', 'aac']
  };

  if (icons.video.includes(ext)) return '🎥';
  if (icons.image.includes(ext)) return '🖼️';
  if (icons.archive.includes(ext)) return '📦';
  if (icons.document.includes(ext)) return '📄';
  if (icons.code.includes(ext)) return '📝';
  if (icons.audio.includes(ext)) return '🎵';
  return '📁';
}

function getMimeType(name) {
  const ext = name.split('.').pop().toLowerCase();
  const mimeTypes = {
    'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png',
    'gif': 'image/gif', 'webp': 'image/webp', 'mp4': 'video/mp4',
    'mkv': 'video/x-matroska', 'avi': 'video/x-msvideo',
    'mov': 'video/quicktime', 'webm': 'video/webm',
    'mp3': 'audio/mpeg', 'wav': 'audio/wav', 'flac': 'audio/flac',
    'pdf': 'application/pdf', 'zip': 'application/zip',
    'rar': 'application/x-rar-compressed', 'txt': 'text/plain',
    'json': 'application/json', 'xml': 'application/xml',
    'html': 'text/html', 'css': 'text/css', 'js': 'application/javascript'
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

function generateHTML(json, folderId) {
  const children = Object.values(json.data.children || {});
  const folders = children.filter(f => f.type === "folder");
  const files = children.filter(f => f.type !== "folder");

  const parentFolderLink = folderId !== CONFIG.ROOT_FOLDER_ID && json.data.parentFolder
    ? `<a href="/?folder=${json.data.parentFolder}" class="back-link">← Back to Parent Folder</a>` 
    : "";

  const folderRows = folders.map(folder => `
    <tr class="folder-row">
      <td class="name-cell">
        <span class="file-icon">📁</span>
        <a href="/?folder=${folder.id}" class="filename" title="${folder.name}">${folder.name}</a>
      </td>
      <td class="type-cell">Folder</td>
      <td class="size-cell">-</td>
      <td class="date-cell">${formatModTime(folder.modTime)}</td>
    </tr>
  `).join("");

  const fileRows = files.map(file => {
    const downloadUrl = `/download/${encodeURIComponent(file.name)}?folder=${folderId}`;
    return `
    <tr class="file-row" data-file-id="${file.id}" data-file-size="${file.size}" data-file-name="${file.name}" data-file-link="${file.link}">
      <td class="name-cell">
        <span class="file-icon">${getFileIcon(file.name)}</span>
        <div class="file-info">
          <a href="${downloadUrl}" class="filename" title="${file.name}">${file.name}</a>
          <span class="direct-link">
            <a href="${file.link}" target="_blank" rel="noopener">Direct Link</a>
          </span>
        </div>
      </td>
      <td class="type-cell">${getMimeType(file.name).split('/')[1]?.toUpperCase() || 'FILE'}</td>
      <td class="size-cell">${formatFileSize(file.size)}</td>
      <td class="date-cell">
        ${formatModTime(file.modTime)}
        <span class="download-count">↓ ${file.downloadCount || 0}</span>
      </td>
      <td class="action-cell">
        <button class="btn-icon-btn" onclick="window.location.href='${downloadUrl}'" title="Download">
          <span class="btn-icon">📥</span>
        </button>
        <!-- FIX: Prepend origin to get full absolute URL -->
        <button class="btn-icon-btn" onclick="copyToClipboard(window.location.origin + '${downloadUrl}')" title="Copy download link">
          <span class="btn-icon">🔗</span>
        </button>
      </td>
    </tr>
    <tr class="progress-row" id="progress-${file.id}" style="display:none;">
      <td colspan="5">
        <div class="download-progress">
          <div class="progress-info">
            <span class="progress-status">Initializing...</span>
            <span class="progress-stats">0% • 0 B/s</span>
          </div>
          <div class="progress-bar-container">
            <div class="progress-bar"></div>
          </div>
          <div class="progress-chunks"></div>
          <div class="progress-actions">
            <button class="btn-pause" onclick="downloadManager.pauseDownload('${file.id}')">⏸ Pause</button>
            <button class="btn-resume" onclick="downloadManager.resumeDownload('${file.id}')" style="display:none;">▶ Resume</button>
            <button class="btn-cancel" onclick="downloadManager.cancelDownload('${file.id}')">✕ Cancel</button>
          </div>
        </div>
      </td>
    </tr>
  `}).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GoFile Index - ${json.data.name || folderId}</title>
  <link rel="icon" href="https://raw.githubusercontent.com/developeranaz/gofile-to-cloudflare-index/refs/heads/main/.images/1747059739966.png" type="image/png">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    :root {
      --bg-primary: #0d1117;
      --bg-secondary: #161b22;
      --bg-tertiary: #21262d;
      --border-color: #30363d;
      --text-primary: #e6edf3;
      --text-secondary: #8b949e;
      --accent: #58a6ff;
      --accent-hover: #79c0ff;
      --success: #238636;
      --warning: #f0883e;
      --danger: #da3633;
      --folder-color: #58a6ff;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      line-height: 1.5;
      min-height: 100vh;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 24px;
    }

    header {
      margin-bottom: 24px;
    }

    h1 {
      font-size: 24px;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 16px;
    }

    .stats-bar {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
      margin-bottom: 20px;
    }

    .stat-card {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 12px 20px;
      min-width: 140px;
    }

    .stat-value {
      font-size: 20px;
      font-weight: 600;
      color: var(--accent);
    }

    .stat-label {
      font-size: 12px;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .toolbar {
      display: flex;
      gap: 12px;
      align-items: center;
      flex-wrap: wrap;
      margin-bottom: 16px;
      padding: 16px;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
    }

    .search-box {
      position: relative;
      flex: 1;
      min-width: 250px;
    }

    .search-box input {
      width: 100%;
      padding: 10px 16px 10px 40px;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      color: var(--text-primary);
      font-size: 14px;
      transition: all 0.2s;
    }

    .search-box input:focus {
      outline: none;
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(88, 166, 255, 0.15);
    }

    .search-box::before {
      content: "🔍";
      position: absolute;
      left: 12px;
      top: 50%;
      transform: translateY(-50%);
      opacity: 0.6;
    }

    .btn {
      padding: 10px 16px;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      color: var(--text-primary);
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .btn:hover {
      background: var(--border-color);
    }

    .btn-primary {
      background: var(--accent);
      border-color: var(--accent);
      color: #fff;
    }

    .btn-primary:hover {
      background: var(--accent-hover);
    }

    .btn-icon-btn {
      padding: 6px 10px;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: 4px;
      color: var(--text-primary);
      cursor: pointer;
      transition: all 0.2s;
      margin: 0 2px;
    }

    .btn-icon-btn:hover {
      background: var(--border-color);
    }

    .back-link {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: var(--accent);
      text-decoration: none;
      margin-bottom: 16px;
      font-size: 14px;
    }

    .back-link:hover {
      color: var(--accent-hover);
    }

    .folder-code {
      font-family: 'SF Mono', monospace;
      font-size: 12px;
      color: var(--text-secondary);
      margin-bottom: 16px;
    }

    .file-table-container {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      overflow: hidden;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }

    th {
      background: var(--bg-tertiary);
      color: var(--text-secondary);
      font-weight: 500;
      text-align: left;
      padding: 12px 16px;
      border-bottom: 1px solid var(--border-color);
      white-space: nowrap;
    }

    td {
      padding: 12px 16px;
      border-bottom: 1px solid var(--border-color);
      vertical-align: middle;
    }

    tr:hover td {
      background: rgba(88, 166, 255, 0.05);
    }

    tr.folder-row td {
      background: rgba(88, 166, 255, 0.03);
    }

    .name-cell {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }

    .file-icon {
      font-size: 18px;
      flex-shrink: 0;
    }

    .file-info {
      display: flex;
      flex-direction: column;
      min-width: 0;
      flex: 1;
    }

    .filename {
      color: var(--accent);
      text-decoration: none;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 400px;
    }

    @media (max-width: 768px) {
      .filename { max-width: 200px; }
    }

    @media (max-width: 480px) {
      .filename { max-width: 120px; }
    }

    .filename:hover {
      color: var(--accent-hover);
      text-decoration: underline;
    }

    .direct-link {
      font-size: 11px;
      color: var(--text-secondary);
    }

    .direct-link a {
      color: var(--text-secondary);
      text-decoration: none;
    }

    .direct-link a:hover {
      color: var(--accent);
    }

    .type-cell {
      color: var(--text-secondary);
      font-size: 12px;
      text-transform: uppercase;
      white-space: nowrap;
    }

    .size-cell {
      color: var(--text-secondary);
      white-space: nowrap;
      font-family: 'SF Mono', monospace;
      font-size: 13px;
    }

    .date-cell {
      color: var(--text-secondary);
      font-size: 12px;
    }

    .download-count {
      display: block;
      margin-top: 2px;
      opacity: 0.7;
    }

    .action-cell {
      text-align: right;
    }

    .btn-download {
      padding: 8px 12px;
      background: var(--success);
      border: none;
      border-radius: 6px;
      color: #fff;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-download:hover {
      background: #2ea043;
      transform: scale(1.05);
    }

    .progress-row td {
      padding: 0;
      background: var(--bg-tertiary) !important;
    }

    .download-progress {
      padding: 16px;
    }

    .progress-info {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 13px;
    }

    .progress-status {
      color: var(--accent);
    }

    .progress-stats {
      color: var(--text-secondary);
      font-family: 'SF Mono', monospace;
    }

    .progress-bar-container {
      height: 8px;
      background: var(--bg-primary);
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 12px;
    }

    .progress-bar {
      height: 100%;
      background: linear-gradient(90deg, var(--accent), var(--accent-hover));
      border-radius: 4px;
      transition: width 0.3s ease;
      width: 0%;
    }

    .progress-chunks {
      display: flex;
      gap: 2px;
      height: 4px;
      margin-bottom: 12px;
    }

    .chunk-indicator {
      flex: 1;
      background: var(--border-color);
      border-radius: 2px;
      transition: background 0.3s;
    }

    .chunk-indicator.completed { background: var(--success); }
    .chunk-indicator.downloading { background: var(--accent); animation: pulse 1s infinite; }
    .chunk-indicator.error { background: var(--danger); }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    .progress-actions {
      display: flex;
      gap: 8px;
    }

    .progress-actions button {
      padding: 6px 12px;
      border: none;
      border-radius: 4px;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-pause { background: var(--warning); color: #fff; }
    .btn-resume { background: var(--success); color: #fff; }
    .btn-cancel { background: var(--danger); color: #fff; }

    footer {
      margin-top: 32px;
      padding: 24px;
      text-align: center;
      border-top: 1px solid var(--border-color);
    }

    footer a {
      color: var(--text-secondary);
      text-decoration: none;
      margin: 0 12px;
      font-size: 13px;
    }

    footer a:hover {
      color: var(--accent);
    }

    .modal {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      z-index: 1000;
      align-items: center;
      justify-content: center;
    }

    .modal.active {
      display: flex;
    }

    .modal-content {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 24px;
      max-width: 500px;
      width: 90%;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    .modal-title {
      font-size: 18px;
      font-weight: 600;
    }

    .modal-close {
      background: none;
      border: none;
      color: var(--text-secondary);
      font-size: 24px;
      cursor: pointer;
    }

    .toast-container {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 1001;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .toast {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 12px 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      animation: slideIn 0.3s ease;
      max-width: 400px;
    }

    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }

    .toast.success { border-left: 4px solid var(--success); }
    .toast.error { border-left: 4px solid var(--danger); }
    .toast.info { border-left: 4px solid var(--accent); }

    @media (max-width: 768px) {
      .container { padding: 16px; }
      .toolbar { flex-direction: column; align-items: stretch; }
      .search-box { min-width: auto; }
      th:nth-child(2), td:nth-child(2),
      th:nth-child(4), td:nth-child(4) { display: none; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>📁 GoFile Index</h1>

      <div class="stats-bar">
        <div class="stat-card">
          <div class="stat-value">${children.length}</div>
          <div class="stat-label">Items</div>
        </div>
        ${(json.data.totalSize || 0) > 0 ? `
        <div class="stat-card">
          <div class="stat-value">${formatFileSize(json.data.totalSize)}</div>
          <div class="stat-label">Total Size</div>
        </div>
        ` : ''}
        <div class="stat-card">
          <div class="stat-value">${json.data.totalDownloadCount || 0}</div>
          <div class="stat-label">Downloads</div>
        </div>
      </div>

      ${parentFolderLink}
      <div class="folder-code">Folder: ${json.data.code || folderId}</div>
    </header>

    <div class="toolbar">
      <div class="search-box">
        <input type="text" id="searchInput" placeholder="Search files and folders...">
      </div>
      <button class="btn btn-primary" onclick="toggleSharedFolder()">📂 Open Shared/Public Folder</button>
    </div>

    <div class="file-table-container">
      <table id="fileTable">
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Size</th>
            <th>Modified</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody id="fileBody">
          ${folderRows}
          ${fileRows}
        </tbody>
      </table>
    </div>

    <footer>
      <a href="#" onclick="showModal('privacy')">Privacy</a>
      <a href="#" onclick="showModal('usage')">Usage Warning</a>
      <a href="#" onclick="showModal('report')">Report</a>
    </footer>
  </div>

  <!-- Shared Folder Modal -->
  <div class="modal" id="sharedModal">
    <div class="modal-content">
      <div class="modal-header">
        <span class="modal-title">Open Shared Folder</span>
        <button class="modal-close" onclick="hideModal('shared')">&times;</button>
      </div>
      <input type="text" id="sharedInput" placeholder="Enter folder URL or ID">
      <button class="btn btn-primary" onclick="openSharedFolder()" style="margin-top:12px;width:100%">Open</button>
    </div>
  </div>

  <!-- Info Modals -->
  <div class="modal" id="privacyModal">
    <div class="modal-content">
      <div class="modal-header">
        <span class="modal-title">Privacy Policy</span>
        <button class="modal-close" onclick="hideModal('privacy')">&times;</button>
      </div>
      <p>This service displays GoFile folder contents. No personal data is stored.</p>
    </div>
  </div>
  
  <div class="modal" id="usageModal">
    <div class="modal-content">
      <div class="modal-header">
        <span class="modal-title">Usage Warning</span>
        <button class="modal-close" onclick="hideModal('usage')">&times;</button>
      </div>
      <p>Do not share illegal content. You are fully responsible for your actions.</p>
    </div>
  </div>
  
  <div class="modal" id="reportModal">
    <div class="modal-content">
      <div class="modal-header">
        <span class="modal-title">Report</span>
        <button class="modal-close" onclick="hideModal('report')">&times;</button>
      </div>
      <p>Report issues to abuse@gofile.io with the folder ID.</p>
    </div>
  </div>

  <div class="toast-container" id="toastContainer"></div>

  <script>

class DownloadManager {
  constructor() {
    this.downloads = new Map();
    this.db = null;
    this.initDB();

    this.config = {
      maxConcurrent: 8,
      minChunkSize: 256 * 1024,      

      defaultChunkSize: 2 * 1024 * 1024, 

      maxChunkSize: 16 * 1024 * 1024,    

      maxRetries: 5,
      retryDelay: 1000
    };
  }

  async initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('DownloadManagerDB', 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('downloads')) {
          db.createObjectStore('downloads', { keyPath: 'id' });
        }
      };
    });
  }

  async saveDownloadState(download) {
    if (!this.db) return;
    const transaction = this.db.transaction(['downloads'], 'readwrite');
    const store = transaction.objectStore('downloads');
    store.put({
      id: download.id,
      filename: download.filename,
      size: download.size,
      url: download.url,
      chunks: download.chunks,
      completedChunks: download.completedChunks,
      timestamp: Date.now()
    });
  }

  async loadDownloadState(id) {
    if (!this.db) return null;
    return new Promise((resolve) => {
      const transaction = this.db.transaction(['downloads'], 'readonly');
      const store = transaction.objectStore('downloads');
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    });
  }

  async deleteDownloadState(id) {
    if (!this.db) return;
    const transaction = this.db.transaction(['downloads'], 'readwrite');
    const store = transaction.objectStore('downloads');
    store.delete(id);
  }

  async checkRangeSupport(url) {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      return response.headers.get('Accept-Ranges') === 'bytes';
    } catch {
      return false;
    }
  }

  calculateChunkSize(fileSize) {
    if (fileSize < this.config.minChunkSize * 4) {
      return fileSize; 

    }

    const targetChunks = this.config.maxConcurrent * 2;
    let chunkSize = Math.ceil(fileSize / targetChunks);

    chunkSize = Math.max(this.config.minChunkSize, chunkSize);
    chunkSize = Math.min(this.config.maxChunkSize, chunkSize);

    return chunkSize;
  }

  async startDownload(fileId, filename, size, url) {

    const existing = this.downloads.get(fileId);
    if (existing && existing.status === 'downloading') {
      this.showToast('Download already in progress', 'info');
      return;
    }

    this.showProgressUI(fileId, filename);

    const supportsRange = await this.checkRangeSupport(url);

    if (!supportsRange || size < this.config.minChunkSize * 4) {

      return this.singleStreamDownload(fileId, filename, size, url);
    }

    return this.parallelDownload(fileId, filename, size, url);
  }

  async parallelDownload(fileId, filename, size, url) {
    const chunkSize = this.calculateChunkSize(size);
    const totalChunks = Math.ceil(size / chunkSize);

    const savedState = await this.loadDownloadState(fileId);

    const download = {
      id: fileId,
      filename,
      size,
      url,
      chunkSize,
      totalChunks,
      chunks: savedState?.chunks || new Array(totalChunks).fill(null).map((_, i) => ({
        index: i,
        start: i * chunkSize,
        end: Math.min((i + 1) * chunkSize - 1, size - 1),
        status: 'pending', 

        retries: 0,
        data: null
      })),
      completedChunks: savedState?.completedChunks || 0,
      status: 'downloading',
      startTime: Date.now(),
      bytesDownloaded: 0,
      speedSamples: [],
      abortController: new AbortController()
    };

    this.downloads.set(fileId, download);

    this.createChunkIndicators(fileId, totalChunks);

    const workers = Math.min(this.config.maxConcurrent, totalChunks);
    const downloadPromises = [];

    for (let i = 0; i < workers; i++) {
      downloadPromises.push(this.downloadWorker(download));
    }

    try {
      await Promise.all(downloadPromises);

      if (download.status === 'cancelled') {
        return;
      }

      await this.mergeAndSave(download);

      await this.deleteDownloadState(fileId);
      this.downloads.delete(fileId);
      this.hideProgressUI(fileId);
      this.showToast(\`\${filename} downloaded successfully!\`, 'success');

    } catch (error) {
      console.error('Download failed:', error);
      download.status = 'error';
      this.updateProgressStatus(fileId, 'Error: ' + error.message);
      this.showToast(\`Download failed: \${error.message}\`, 'error');
    }
  }

  async downloadWorker(download) {
    while (download.status === 'downloading') {

      const chunk = download.chunks.find(c => c.status === 'pending');

      if (!chunk) {

        break;
      }

      chunk.status = 'downloading';
      this.updateChunkIndicator(download.id, chunk.index, 'downloading');

      try {
        const chunkData = await this.downloadChunk(download, chunk);
        chunk.data = chunkData;
        chunk.status = 'completed';
        download.completedChunks++;
        download.bytesDownloaded += chunkData.byteLength;
        this.updateChunkIndicator(download.id, chunk.index, 'completed');
        this.updateProgress(download);

        if (download.completedChunks % 5 === 0) {
          await this.saveDownloadState(download);
        }

      } catch (error) {
        if (download.status === 'cancelled') return;

        chunk.retries++;
        chunk.status = chunk.retries < this.config.maxRetries ? 'pending' : 'error';

        if (chunk.status === 'error') {
          this.updateChunkIndicator(download.id, chunk.index, 'error');
          throw new Error(\`Chunk \${chunk.index} failed after \${this.config.maxRetries} retries\`);
        }

        await this.delay(this.config.retryDelay * Math.pow(2, chunk.retries));
      }
    }
  }

  async downloadChunk(download, chunk) {
    const headers = {
      'Range': \`bytes=\${chunk.start}-\${chunk.end}\`,
      'Accept': '*/*',
      'Referer': 'https://gofile.io/'
    };

    const response = await fetch(download.url, {
      headers,
      signal: download.abortController.signal
    });

    if (!response.ok && response.status !== 206) {
      throw new Error(\`HTTP \${response.status}\`);
    }

    return await response.arrayBuffer();
  }

  async singleStreamDownload(fileId, filename, size, url) {
    const download = {
      id: fileId,
      filename,
      size,
      url,
      status: 'downloading',
      startTime: Date.now(),
      bytesDownloaded: 0,
      abortController: new AbortController()
    };

    this.downloads.set(fileId, download);
    this.updateProgressStatus(fileId, 'Downloading (single stream)...');

    try {
      const response = await fetch(url, {
        signal: download.abortController.signal
      });

      if (!response.ok) {
        throw new Error(\`HTTP \${response.status}\`);
      }

      const reader = response.body.getReader();
      const chunks = [];

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        chunks.push(value);
        download.bytesDownloaded += value.byteLength;
        this.updateProgress(download);
      }

      const blob = new Blob(chunks);
      this.saveFile(blob, filename);

      this.downloads.delete(fileId);
      this.hideProgressUI(fileId);
      this.showToast(\`\${filename} downloaded successfully!\`, 'success');

    } catch (error) {
      if (download.status !== 'cancelled') {
        console.error('Download failed:', error);
        this.updateProgressStatus(fileId, 'Error: ' + error.message);
        this.showToast(\`Download failed: \${error.message}\`, 'error');
      }
    }
  }

  async mergeAndSave(download) {
    this.updateProgressStatus(download.id, 'Merging chunks...');

    const sortedChunks = download.chunks
      .filter(c => c.data)
      .sort((a, b) => a.index - b.index);

    const blobs = sortedChunks.map(c => new Blob([c.data]));
    const finalBlob = new Blob(blobs);

    this.saveFile(finalBlob, download.filename);
  }

  saveFile(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  updateProgress(download) {
    const percent = Math.round((download.bytesDownloaded / download.size) * 100);
    const elapsed = (Date.now() - download.startTime) / 1000;
    const speed = elapsed > 0 ? download.bytesDownloaded / elapsed : 0;

    const progressRow = document.getElementById(\`progress-\${download.id}\`);
    if (!progressRow) return;

    const bar = progressRow.querySelector('.progress-bar');
    const stats = progressRow.querySelector('.progress-stats');

    bar.style.width = \`\${percent}%\`;
    stats.textContent = \`\${percent}% • \${this.formatSpeed(speed)}\`;
  }

  updateProgressStatus(fileId, status) {
    const progressRow = document.getElementById(\`progress-\${fileId}\`);
    if (!progressRow) return;

    const statusEl = progressRow.querySelector('.progress-status');
    if (statusEl) statusEl.textContent = status;
  }

  formatSpeed(bytesPerSecond) {
    if (bytesPerSecond < 1024) return bytesPerSecond.toFixed(0) + ' B/s';
    if (bytesPerSecond < 1024 * 1024) return (bytesPerSecond / 1024).toFixed(1) + ' KB/s';
    return (bytesPerSecond / (1024 * 1024)).toFixed(2) + ' MB/s';
  }

  showProgressUI(fileId, filename) {
    const progressRow = document.getElementById(\`progress-\${fileId}\`);
    if (progressRow) {
      progressRow.style.display = 'table-row';
    }
  }

  hideProgressUI(fileId) {
    const progressRow = document.getElementById(\`progress-\${fileId}\`);
    if (progressRow) {
      progressRow.style.display = 'none';
    }
  }

  createChunkIndicators(fileId, count) {
    const progressRow = document.getElementById(\`progress-\${fileId}\`);
    if (!progressRow) return;

    const container = progressRow.querySelector('.progress-chunks');
    if (!container) return;

    container.innerHTML = '';
    for (let i = 0; i < Math.min(count, 50); i++) {
      const indicator = document.createElement('div');
      indicator.className = 'chunk-indicator';
      indicator.dataset.chunk = i;
      container.appendChild(indicator);
    }
  }

  updateChunkIndicator(fileId, chunkIndex, status) {
    const progressRow = document.getElementById(\`progress-\${fileId}\`);
    if (!progressRow) return;

    const indicator = progressRow.querySelector(\`.chunk-indicator[data-chunk="\${chunkIndex}"]\`);
    if (indicator) {
      indicator.className = \`chunk-indicator \${status}\`;
    }
  }

  pauseDownload(fileId) {
    const download = this.downloads.get(fileId);
    if (download) {
      download.status = 'paused';
      download.abortController.abort();
      this.saveDownloadState(download);
      this.updateProgressStatus(fileId, 'Paused');

      const progressRow = document.getElementById(\`progress-\${fileId}\`);
      if (progressRow) {
        progressRow.querySelector('.btn-pause').style.display = 'none';
        progressRow.querySelector('.btn-resume').style.display = 'inline-block';
      }
    }
  }

  async resumeDownload(fileId) {
    const download = this.downloads.get(fileId);
    if (download && download.status === 'paused') {
      download.status = 'downloading';
      download.abortController = new AbortController();

      const progressRow = document.getElementById(\`progress-\${fileId}\`);
      if (progressRow) {
        progressRow.querySelector('.btn-pause').style.display = 'inline-block';
        progressRow.querySelector('.btn-resume').style.display = 'none';
      }

      const workers = Math.min(this.config.maxConcurrent, download.totalChunks);
      const promises = [];
      for (let i = 0; i < workers; i++) {
        promises.push(this.downloadWorker(download));
      }

      await Promise.all(promises);

      if (download.completedChunks === download.totalChunks) {
        await this.mergeAndSave(download);
        await this.deleteDownloadState(fileId);
        this.downloads.delete(fileId);
        this.hideProgressUI(fileId);
        this.showToast(\`\${download.filename} downloaded successfully!\`, 'success');
      }
    }
  }

  cancelDownload(fileId) {
    const download = this.downloads.get(fileId);
    if (download) {
      download.status = 'cancelled';
      download.abortController.abort();
      this.downloads.delete(fileId);
      this.hideProgressUI(fileId);
      this.showToast('Download cancelled', 'info');
    }
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = \`toast \${type}\`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 5000);
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

const downloadManager = new DownloadManager();

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    downloadManager.showToast('Link copied to clipboard!', 'success');
  }).catch(() => {

    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    downloadManager.showToast('Link copied to clipboard!', 'success');
  });
}

function toggleSharedFolder() {
  document.getElementById('sharedModal').classList.add('active');
}

function hideModal(type) {
  document.getElementById(type + 'Modal').classList.remove('active');
}

function openSharedFolder() {
  const input = document.getElementById('sharedInput').value.trim();
  if (!input) return;

  const folderId = input.includes('gofile.io/d/') 
    ? input.split('/d/')[1].split('/')[0]
    : input;

  window.location.href = '/?folder=' + folderId;
}

function showModal(type) {
  document.getElementById(type + 'Modal').classList.add('active');
}

document.getElementById('searchInput')?.addEventListener('input', function() {
  const query = this.value.toLowerCase();
  const rows = document.querySelectorAll('#fileBody tr:not(.progress-row)');

  rows.forEach(row => {
    const text = row.textContent.toLowerCase();
    row.style.display = text.includes(query) ? '' : 'none';
  });
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
  }
});

document.getElementById('sharedInput')?.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') openSharedFolder();
});
  </script>
</body>
</html>`;
}

async function handleRequest(event) {
  const request = event.request;
  const url = new URL(request.url);
  const path = url.pathname;
  const folderId = url.searchParams.get("folder") || CONFIG.ROOT_FOLDER_ID;

  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Range, Content-Type, Authorization",
        "Access-Control-Expose-Headers": "Content-Length, Content-Range, ETag, Accept-Ranges"
      }
    });
  }

  if (path === "/" && !url.searchParams.get("folder") && CONFIG.AUTHENTICATION === "true") {
    if (!checkAuth(request)) {
      return new Response("Unauthorized", { 
        status: 401,
        headers: {
          "WWW-Authenticate": 'Basic realm="GoFile Index"',
          "Content-Type": "text/plain"
        }
      });
    }
  }

  if (path === "/api/download-token") {
    const fileId = url.searchParams.get("fileId");
    const folderIdParam = url.searchParams.get("folder") || CONFIG.ROOT_FOLDER_ID;

    if (!fileId) {
      return new Response(JSON.stringify({ error: "Missing fileId" }), { 
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const json = await fetchFileList(folderIdParam);
    if (json.status !== "ok") {
      return new Response(JSON.stringify({ error: "Failed to fetch file list" }), { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const files = Object.values(json.data.children || {});
    const file = files.find(f => f.id === fileId);

    if (!file) {
      return new Response(JSON.stringify({ error: "File not found" }), { 
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    const token = await generateDownloadToken(file);
    return new Response(JSON.stringify(token), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }

  if (path === "/") {
    const json = await fetchFileList(folderId);

    if (json.status !== "ok") {
      return new Response(`Error: ${json.message || "Failed to fetch files"}`, { 
        status: 500,
        headers: { "Content-Type": "text/plain" }
      });
    }

    const html = generateHTML(json, folderId);
    return new Response(html, {
      headers: { 
        "Content-Type": "text/html",
        "Cache-Control": "no-cache"
      }
    });
  }

  if (path.startsWith("/download/")) {
    const fileName = decodeURIComponent(path.replace("/download/", ""));
    const json = await fetchFileList(folderId);

    if (json.status !== "ok") {
      return new Response("File list error", { status: 500 });
    }

    const files = Object.values(json.data.children || {});
    const file = files.find(f => f.name === fileName);

    if (!file) {
      return new Response("File not found", { status: 404 });
    }

    return handleStreamDownload(file, request);
  }

  return new Response("Not Found", { status: 404 });
}

addEventListener("fetch", event => {
  event.respondWith(handleRequest(event));
});
