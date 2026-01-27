//edited on 27012026 
const GOFILE_API_BASE = "https://api.gofile.io/contents/";
const AUTH_TOKEN = "Bearer THEGOFILETOKEN"; // Replace with your API Key
const ROOT_FOLDER_ID = "THEROOTFOLDERID"; // Replace your custom or root folder ID here
const AUTHENTICATION = "false"; // Replace with "true" or "false"
const OPTIONAL_USER = "oneu"; // Replace with your custom username
const OPTIONAL_PASS = "onep"; // Replace with your custom password
// THIS IS A BETA VERSION OF CODE AND MAY CONTAIN ERROR IN NEW FEATURES
// Gofile File Manager - Clean Version
// Updated: January 2026


// Cache settings
const CACHE_TTL = 300;

// Cache for API responses
const cache = {
    data: null,
    timestamp: 0,
    ttl: CACHE_TTL * 1000
};

async function fetchFileList(folderId) {
    try {
        // Check cache first
        if (cache.data && (Date.now() - cache.timestamp) < cache.ttl && cache.data.id === folderId) {
            return cache.data;
        }

        const response = await fetch(`${GOFILE_API_BASE}${folderId}?contentFilter=&page=1&pageSize=1000&sortField=createTime&sortDirection=-1`, {
            headers: {
                "Authorization": AUTH_TOKEN,
                "x-website-token": "4fd6sg89d7s6",
                "Accept": "application/json"
            }
        });
        
        if (!response.ok) {
            throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.status !== "ok") {
            throw new Error(`API error: ${data.message || "Unknown error"}`);
        }
        
        // Cache the response
        cache.data = data;
        cache.timestamp = Date.now();
        cache.data.id = folderId;
        
        return data;
    } catch (error) {
        console.error("Fetch file list error:", error);
        return { status: "error", message: error.message };
    }
}

async function makeFolderPrivate(folderId) {
    try {
        const response = await fetch(`${GOFILE_API_BASE}${folderId}/update`, {
            method: "PUT",
            headers: {
                "User-Agent": "Mozilla/5.0",
                "Content-Type": "application/json",
                "Authorization": AUTH_TOKEN,
                "x-website-token": "4fd6sg89d7s6"
            },
            body: JSON.stringify({ "attribute": "public", "attributeValue": false })
        });
        if (!response.ok) {
            console.warn(`Failed to make folder private: ${response.statusText}`);
        }
    } catch (error) {
        console.error("Make folder private error:", error);
    }
}

function formatFileSize(bytes) {
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    if (bytes === 0) return "0 Bytes";
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(2) + " " + sizes[i];
}

function formatModTime(timestamp) {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
}

function getFileIcon(name) {
    const ext = name.split('.').pop().toLowerCase();
    if (['mp4', 'mkv', 'avi', 'mov', 'webm'].includes(ext)) return '🎥';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return '🖼️';
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return '📦';
    if (['pdf'].includes(ext)) return '📄';
    if (['txt', 'json', 'xml', 'html', 'css', 'js'].includes(ext)) return '📝';
    if (['mp3', 'wav', 'flac', 'aac'].includes(ext)) return '🎵';
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
        'rar': 'application/x-rar-compressed',
        'txt': 'text/plain', 'json': 'application/json',
        'xml': 'application/xml', 'html': 'text/html',
        'css': 'text/css', 'js': 'application/javascript'
    };
    return mimeTypes[ext] || 'application/octet-stream';
}

function checkAuth(request) {
    if (AUTHENTICATION !== "true") return true;
    
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Basic ")) {
        return false;
    }
    
    const base64Credentials = authHeader.split(" ")[1];
    const credentials = atob(base64Credentials);
    const [username, password] = credentials.split(":");
    return username === OPTIONAL_USER && password === OPTIONAL_PASS;
}

async function handleDownload(file, request) {
    try {
        const downloadUrl = file.link;
        
        // Handle range requests for large files
        const range = request.headers.get("Range");
        const options = {
            headers: {
                "Accept": "*/*",
                "Referer": "https://gofile.io/",
                "User-Agent": request.headers.get("User-Agent") || "Mozilla/5.0",
                "Cookie": `accountToken=${AUTH_TOKEN.split(" ")[1]}`
            }
        };
        
        if (range) {
            options.headers["Range"] = range;
        }
        
        // Fetch from Gofile
        const fileResponse = await fetch(downloadUrl, options);
        
        if (!fileResponse.ok) {
            throw new Error(`Download error: ${fileResponse.status}`);
        }
        
        // Create response headers
        const responseHeaders = new Headers(fileResponse.headers);
        
        // Set content disposition for download
        responseHeaders.set("Content-Disposition", `attachment; filename="${encodeURIComponent(file.name)}"`);
        responseHeaders.set("Content-Type", getMimeType(file.name));
        
        // Handle caching
        responseHeaders.set("Cache-Control", "public, max-age=86400");
        responseHeaders.set("Accept-Ranges", "bytes");
        
        // Handle CORS
        responseHeaders.set("Access-Control-Allow-Origin", "*");
        responseHeaders.set("Access-Control-Expose-Headers", "*");
        
        return new Response(fileResponse.body, {
            status: fileResponse.status,
            statusText: fileResponse.statusText,
            headers: responseHeaders
        });
        
    } catch (error) {
        console.error("Download error:", error);
        return new Response(`Error: ${error.message}`, { 
            status: 500,
            headers: { "Content-Type": "text/plain" }
        });
    }
}

async function handleRequest(event) {
    const request = event.request;
    const url = new URL(request.url);
    const folderId = url.searchParams.get("folder") || ROOT_FOLDER_ID;
    const path = url.pathname;

    // Authentication check for root path
    if (path === "/" && !url.searchParams.get("folder") && AUTHENTICATION === "true") {
        if (!checkAuth(request)) {
            return new Response(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Sundarans Private Files - Login</title>
    <link rel="icon" href="https://raw.githubusercontent.com/developeranaz/gofile-to-cloudflare-index/refs/heads/main/.images/1747059739966.png" type="image/png">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background-color: #1a1a1a;
            color: #e0e0e0;
            padding: 20px;
            line-height: 1.6;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
        }
        .container {
            max-width: 400px;
            background-color: #222222;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        }
        h2 {
            color: #4da8ff;
            font-size: 1.8em;
            margin-bottom: 20px;
            text-align: center;
        }
        input {
            width: 100%;
            padding: 12px;
            margin-bottom: 15px;
            font-size: 16px;
            background-color: #2a2a2a;
            color: #e0e0e0;
            border: 1px solid #444;
            border-radius: 6px;
            transition: border-color 0.2s ease;
        }
        input:focus {
            outline: none;
            border-color: #4da8ff;
            box-shadow: 0 0 8px rgba(77, 168, 255, 0.3);
        }
        button {
            width: 100%;
            padding: 12px;
            font-size: 16px;
            background-color: #4da8ff;
            color: #ffffff;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            transition: background-color 0.2s ease;
        }
        button:hover { background-color: #3b8adb; }
        .error {
            color: #ff5555;
            text-align: center;
            margin-bottom: 15px;
            display: none;
        }
        @media (max-width: 600px) {
            .container { padding: 20px; width: 90%; }
            h2 { font-size: 1.5em; }
        }
    </style>
</head>
<body>
    <div class="container">
        <h2>Sundarans Private Files - Login</h2>
        <p class="error" id="error">Invalid username or password</p>
        <input type="text" id="username" placeholder="Username">
        <input type="password" id="password" placeholder="Password">
        <button onclick="tryLogin()">Login</button>
    </div>
    <script>
        function setCookie(name, value, days) {
            const expires = new Date();
            expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
            document.cookie = \`\${name}=\${value};expires=\${expires.toUTCString()};path=/;SameSite=Strict\`;
        }

        function getCookie(name) {
            const value = \`; \${document.cookie}\`;
            const parts = value.split(\`; \${name}=\`);
            if (parts.length === 2) return parts.pop().split(';').shift();
            return null;
        }

        function tryLogin() {
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const auth = btoa(\`\${username}:\${password}\`);
            setCookie('gofile_auth', auth, 7);
            fetch('/', {
                headers: { 'Authorization': \`Basic \${auth}\` }
            }).then(response => {
                if (response.ok) {
                    window.location.reload();
                } else {
                    document.getElementById('error').style.display = 'block';
                }
            }).catch(() => {
                document.getElementById('error').style.display = 'block';
            });
        }

        document.getElementById('password').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') tryLogin();
        });

        const authCookie = getCookie('gofile_auth');
        if (authCookie) {
            fetch('/', {
                headers: { 'Authorization': \`Basic \${authCookie}\` }
            }).then(response => {
                if (response.ok) window.location.reload();
            });
        }
    </script>
</body>
</html>
            `, {
                status: 401,
                headers: {
                    "WWW-Authenticate": 'Basic realm="Sundarans Private Files"',
                    "Content-Type": "text/html"
                }
            });
        }
    }

    // Handle homepage (file listing)
    if (path === "/") {
        const json = await fetchFileList(folderId);
        
        if (json.status !== "ok") {
            return new Response(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Sundarans Private Files - Error</title>
    <link rel="icon" href="https://raw.githubusercontent.com/developeranaz/gofile-to-cloudflare-index/refs/heads/main/.images/1747059739966.png" type="image/png">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background-color: #1a1a1a;
            color: #e0e0e0;
            padding: 20px;
            line-height: 1.6;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
        }
        .container {
            max-width: 600px;
            background-color: #222222;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            text-align: center;
        }
        h2 { color: #ff5555; font-size: 1.8em; margin-bottom: 20px; }
        p { color: #a0a0a0; }
        a { color: #4da8ff; text-decoration: none; }
        a:hover { color: #7cc1ff; }
    </style>
</head>
<body>
    <div class="container">
        <h2>Error Fetching Files</h2>
        <p>${json.message || "Unable to fetch files. Please check the folder ID or API token."}</p>
        <p>Possible issues: Invalid API token, incorrect folder ID, or GoFile API restrictions.</p>
        <p><a href="/">Back to Home</a></p>
    </div>
</body>
</html>
            `, { status: 500, headers: { "Content-Type": "text/html" } });
        }

        await makeFolderPrivate(folderId);
        
        let parentFolderLink = folderId !== ROOT_FOLDER_ID && json.data.parentFolder
            ? `<a href="/?folder=${json.data.parentFolder}">← Back to Parent Folder</a><br>` 
            : "";

        // Filter folders and files
        const children = Object.values(json.data.children || {});
        const folders = children.filter(f => f.type === "folder");
        const files = children.filter(f => f.type !== "folder");

        // Generate folder rows
        let folderRows = folders.map(folder => `
            <tr>
                <td>📁 <a href="/?folder=${folder.id}">${folder.name}</a></td>
                <td>Folder</td>
                <td>-</td>
                <td>${formatModTime(folder.modTime)}</td>
            </tr>`).join("");

        // Generate file rows
        let fileRows = files.map(file => {
            const downloadLink = `/download/${encodeURIComponent(file.name)}?folder=${folderId}`;
            const directLink = file.link;
            
            return `
            <tr>
                <td>${getFileIcon(file.name)} <a href="${downloadLink}">${file.name}</a>
                    <br><small style="color: #666; font-size: 0.8em;">
                        <a href="${directLink}" target="_blank" style="color: #666;">(Direct Link)</a>
                    </small>
                </td>
                <td>${formatFileSize(file.size)}</td>
                <td>${file.mimetype || getMimeType(file.name)}</td>
                <td>${formatModTime(file.modTime)}<br><small style="color: #666;">Downloads: ${file.downloadCount || 0}</small></td>
            </tr>`;
        }).join("");

        return new Response(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Sundarans Private Files - ${folderId}</title>
    <link rel="icon" href="https://raw.githubusercontent.com/developeranaz/gofile-to-cloudflare-index/refs/heads/main/.images/1747059739966.png" type="image/png">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background-color: #1a1a1a;
            color: #e0e0e0;
            padding: 20px;
            line-height: 1.6;
        }
        h2 {
            color: #4da8ff;
            font-size: 2.2em;
            margin-bottom: 20px;
            font-weight: 600;
        }
        .shared-section { margin-bottom: 20px; }
        #sharedInput {
            max-height: 0;
            overflow: hidden;
            transition: max-height 0.3s ease;
        }
        #sharedInput.visible { max-height: 150px; }
        .shared-button {
            padding: 10px 20px;
            font-size: 16px;
            background-color: #4da8ff;
            color: #ffffff;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            transition: background-color 0.2s ease;
        }
        .shared-button:hover { background-color: #3b8adb; }
        input {
            width: 100%;
            padding: 12px;
            margin-bottom: 10px;
            font-size: 16px;
            background-color: #2a2a2a;
            color: #e0e0e0;
            border: 1px solid #444;
            border-radius: 6px;
            transition: border-color 0.2s ease;
        }
        input:focus {
            outline: none;
            border-color: #4da8ff;
            box-shadow: 0 0 8px rgba(77, 168, 255, 0.3);
        }
        button {
            padding: 10px 20px;
            font-size: 16px;
            background-color: #4da8ff;
            color: #ffffff;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            transition: background-color 0.2s ease;
            margin: 5px;
        }
        button:hover { background-color: #3b8adb; }
        .container {
            max-width: 1000px;
            margin: 0 auto;
            background-color: #222222;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        }
        table {
            width: 100%;
            border-collapse: collapse;
            background: #2a2a2a;
            border-radius: 8px;
            overflow: hidden;
            margin-bottom: 20px;
        }
        th, td {
            padding: 14px;
            text-align: left;
            border-bottom: 1px solid #3a3a3a;
        }
        th {
            background-color: #333333;
            color: #4da8ff;
            font-weight: 600;
        }
        td { color: #d0d0d0; }
        a {
            color: #4da8ff;
            text-decoration: none;
            transition: color 0.2s ease;
        }
        a:hover { color: #7cc1ff; }
        .deploy-id {
            margin-bottom: 15px;
            color: #a0a0a0;
        }
        .logout {
            display: inline-block;
            margin-top: 10px;
            padding: 8px 16px;
            background-color: #ff5555;
            color: #ffffff;
            border-radius: 6px;
            cursor: pointer;
        }
        .logout:hover { background-color: #cc4444; }
        footer {
            text-align: center;
            padding: 15px;
            background: #333333;
            border-radius: 8px;
            margin-top: 20px;
        }
        footer a {
            margin: 0 15px;
            color: #4da8ff;
            font-size: 0.9em;
        }
        footer a:hover { color: #7cc1ff; }
        .modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            z-index: 1000;
        }
        .modal-content {
            background: #2a2a2a;
            margin: 15% auto;
            padding: 25px;
            width: 80%;
            max-width: 500px;
            border-radius: 10px;
            position: relative;
            color: #e0e0e0;
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
        }
        .modal-content h3 {
            color: #4da8ff;
            margin-bottom: 15px;
        }
        .modal-content a { color: #4da8ff; }
        .modal-content a:hover { color: #7cc1ff; }
        .close {
            position: absolute;
            top: 10px;
            right: 15px;
            color: #888;
            font-size: 28px;
            cursor: pointer;
            transition: color 0.2s ease;
        }
        .close:hover { color: #e0e0e0; }
        .stats-bar {
            display: flex;
            gap: 20px;
            margin: 15px 0;
            flex-wrap: wrap;
        }
        .stat-item {
            background: #333;
            padding: 10px 15px;
            border-radius: 6px;
            min-width: 150px;
        }
        .stat-value {
            font-size: 1.2em;
            font-weight: bold;
            color: #4da8ff;
        }
        @media (max-width: 600px) {
            table { display: block; overflow-x: auto; white-space: nowrap; }
            .modal-content { width: 90%; margin: 20% auto; }
            body { padding: 10px; }
            .container { padding: 15px; }
            .shared-button, button, .logout { font-size: 14px; padding: 8px 16px; }
            input { font-size: 14px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <h2>Sundarans Private Files</h2>
        
        <div class="stats-bar">
            <div class="stat-item">
                <div class="stat-value">${children.length}</div>
                <div>Total Items</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${formatFileSize(json.data.totalSize || 0)}</div>
                <div>Total Size</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${json.data.totalDownloadCount || 0}</div>
                <div>Total Downloads</div>
            </div>
        </div>
        
        <div class="shared-section">
            <button class="shared-button" onclick="toggleSharedInput()">Shared/Public</button>
            <div id="sharedInput">
                <input type="text" id="folderInput" placeholder="Enter URL or Folder ID (e.g. A0LCPx)">
                <button onclick="openSharedFolder()">View/Index</button>
            </div>
        </div>
        
        ${parentFolderLink}
        <p class="deploy-id">Folder Code: <span id="deployId">${json.data.code || 'N/A'}</span></p>
        ${AUTHENTICATION === "true" ? '<a class="logout" onclick="logout()">Log Out</a>' : ''}
        
        <input type="text" id="search" placeholder="Search files...">
        
        <table id="fileTable">
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Size</th>
                    <th>Type</th>
                    <th>Modified / Downloads</th>
                </tr>
            </thead>
            <tbody id="fileBody">
                ${folderRows}
                ${fileRows}
            </tbody>
        </table>
        
        <footer>
            <a href="#" onclick="openModal('privacy')">Privacy Policy</a> |
            <a href="#" onclick="openModal('usage')">Usage Warning</a> |
            <a href="#" onclick="openModal('report')">Report Abuse</a>
        </footer>
    </div>
    
    <div id="privacyModal" class="modal">
        <div class="modal-content">
            <span class="close" onclick="closeModal('privacy')">×</span>
            <h3>Privacy Policy</h3>
            <p>This service displays GoFile folder contents. We don't store any personal data.</p>
        </div>
    </div>
    
    <div id="usageModal" class="modal">
        <div class="modal-content">
            <span class="close" onclick="closeModal('usage')">×</span>
            <h3>Usage Warning</h3>
            <p>You are fully responsible for the content you share.</p>
        </div>
    </div>
    
    <div id="reportModal" class="modal">
        <div class="modal-content">
            <span class="close" onclick="closeModal('report')">×</span>
            <h3>Report Abuse</h3>
            <p>Report issues to <a href="mailto:abuse@gofile.io">abuse@gofile.io</a></p>
        </div>
    </div>
    
    <script>
        function toggleSharedInput() {
            document.getElementById('sharedInput').classList.toggle('visible');
        }

        function openSharedFolder() {
            const input = document.getElementById('folderInput').value;
            const folderId = input.includes('gofile.io/d/') 
                ? input.split('/d/')[1].split('/')[0]
                : input.trim();
            window.open(location.origin + '/?folder=' + folderId, '_blank');
        }

        function logout() {
            document.cookie = 'gofile_auth=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;SameSite=Strict';
            window.location.reload();
        }

        document.getElementById('folderInput').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') openSharedFolder();
        });

        document.addEventListener("DOMContentLoaded", () => {
            let tbody = document.getElementById("fileBody");
            let rows = Array.from(tbody.children);
            // Sort by type (folders first), then by name
            rows.sort((a, b) => {
                const isAFolder = a.textContent.includes('📁');
                const isBFolder = b.textContent.includes('📁');
                if (isAFolder && !isBFolder) return -1;
                if (!isAFolder && isBFolder) return 1;
                return a.textContent.localeCompare(b.textContent);
            });
            tbody.innerHTML = "";
            rows.forEach(row => tbody.appendChild(row));
        });

        document.getElementById("search").addEventListener("input", function() {
            let input = this.value.toLowerCase();
            let rows = document.querySelectorAll("#fileTable tbody tr");
            rows.forEach(row => {
                let fileName = row.textContent.toLowerCase();
                row.style.display = fileName.includes(input) ? "" : "none";
            });
        });

        function openModal(type) { 
            document.getElementById(type + 'Modal').style.display = 'block'; 
        }
        function closeModal(type) { 
            document.getElementById(type + 'Modal').style.display = 'none'; 
        }
        
        // Close modal when clicking outside
        window.onclick = function(event) {
            if (event.target.className === 'modal') {
                event.target.style.display = 'none';
            }
        }
    </script>
</body>
</html>
        `, { headers: { "Content-Type": "text/html" } });
    }

    // Handle downloads (exact same URL structure as first script)
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
        
        return handleDownload(file, request);
    }

    return new Response("Not Found", { status: 404 });
}

addEventListener("fetch", event => {
    event.respondWith(handleRequest(event));
});                                          
