// Dark Terminal Theme edited on 28012026 
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
        @font-face {
            font-family: 'Terminal';
            src: url('https://fonts.cdnfonts.com/css/cascadia-code');
        }
        body {
            font-family: 'Terminal', 'Cascadia Code', 'Courier New', monospace;
            background-color: #0a0a0a;
            background-image: 
                linear-gradient(rgba(0, 255, 0, 0.02) 1px, transparent 1px),
                linear-gradient(90deg, rgba(0, 255, 0, 0.02) 1px, transparent 1px);
            background-size: 20px 20px;
            color: #00ff00;
            padding: 20px;
            line-height: 1.6;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            position: relative;
            overflow: hidden;
        }
        body::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: repeating-linear-gradient(
                0deg,
                rgba(0, 255, 0, 0.03) 0px,
                rgba(0, 255, 0, 0.03) 1px,
                transparent 1px,
                transparent 2px
            );
            pointer-events: none;
            z-index: 0;
        }
        .container {
            max-width: 400px;
            background-color: rgba(10, 20, 10, 0.95);
            padding: 30px;
            border-radius: 4px;
            border: 1px solid #00ff00;
            box-shadow: 
                0 0 15px rgba(0, 255, 0, 0.3),
                inset 0 0 20px rgba(0, 255, 0, 0.1);
            position: relative;
            z-index: 1;
            animation: glitch 0.5s infinite;
        }
        @keyframes glitch {
            0%, 100% { transform: translate(0); }
            92% { transform: translate(-1px, 1px); }
            94% { transform: translate(1px, -1px); }
            96% { transform: translate(-1px, -1px); }
            98% { transform: translate(1px, 1px); }
        }
        h2 {
            color: #00ff00;
            font-size: 1.8em;
            margin-bottom: 20px;
            text-align: center;
            text-shadow: 0 0 10px rgba(0, 255, 0, 0.5);
            letter-spacing: 2px;
        }
        input {
            width: 100%;
            padding: 12px;
            margin-bottom: 15px;
            font-size: 16px;
            background-color: rgba(0, 20, 0, 0.8);
            color: #00ff00;
            border: 1px solid #00aa00;
            border-radius: 2px;
            transition: all 0.3s ease;
            font-family: 'Terminal', monospace;
            letter-spacing: 1px;
        }
        input::placeholder {
            color: #008800;
        }
        input:focus {
            outline: none;
            border-color: #00ff00;
            box-shadow: 0 0 10px rgba(0, 255, 0, 0.5);
            background-color: rgba(0, 30, 0, 0.8);
        }
        button {
            width: 100%;
            padding: 12px;
            font-size: 16px;
            background-color: #002200;
            color: #00ff00;
            border: 1px solid #00ff00;
            border-radius: 2px;
            cursor: pointer;
            transition: all 0.3s ease;
            font-family: 'Terminal', monospace;
            letter-spacing: 1px;
            position: relative;
            overflow: hidden;
        }
        button:hover { 
            background-color: #003300;
            box-shadow: 0 0 15px rgba(0, 255, 0, 0.5);
            transform: translateY(-1px);
        }
        button:active {
            transform: translateY(1px);
        }
        button::after {
            content: '>';
            position: absolute;
            right: 10px;
            opacity: 0;
            transition: opacity 0.3s ease;
        }
        button:hover::after {
            opacity: 1;
        }
        .error {
            color: #ff5555;
            text-align: center;
            margin-bottom: 15px;
            display: none;
            text-shadow: 0 0 5px rgba(255, 85, 85, 0.5);
            animation: blink 1s infinite;
        }
        @keyframes blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        .terminal-line {
            color: #008800;
            margin-bottom: 10px;
            font-size: 0.9em;
        }
        @media (max-width: 600px) {
            .container { padding: 20px; width: 90%; }
            h2 { font-size: 1.5em; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="terminal-line">$ SYSTEM ACCESS REQUESTED</div>
        <div class="terminal-line">$ INITIALIZING AUTHENTICATION...</div>
        <h2>SYSTEM LOGIN</h2>
        <p class="error" id="error">ACCESS DENIED: Invalid credentials</p>
        <input type="text" id="username" placeholder="USERNAME">
        <input type="password" id="password" placeholder="PASSWORD">
        <button onclick="tryLogin()">LOGIN</button>
        <div class="terminal-line" style="margin-top: 15px;">$ Ready for authentication...</div>
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
        @font-face {
            font-family: 'Terminal';
            src: url('https://fonts.cdnfonts.com/css/cascadia-code');
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Terminal', 'Cascadia Code', 'Courier New', monospace;
            background-color: #0a0a0a;
            background-image: 
                linear-gradient(rgba(0, 255, 0, 0.02) 1px, transparent 1px),
                linear-gradient(90deg, rgba(0, 255, 0, 0.02) 1px, transparent 1px);
            background-size: 20px 20px;
            color: #00ff00;
            padding: 20px;
            line-height: 1.6;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
        }
        .container {
            max-width: 600px;
            background-color: rgba(10, 20, 10, 0.95);
            padding: 30px;
            border-radius: 4px;
            border: 1px solid #00ff00;
            box-shadow: 
                0 0 15px rgba(0, 255, 0, 0.3),
                inset 0 0 20px rgba(0, 255, 0, 0.1);
            text-align: center;
        }
        h2 { 
            color: #ff5555; 
            font-size: 1.8em; 
            margin-bottom: 20px; 
            text-shadow: 0 0 10px rgba(255, 85, 85, 0.5);
            letter-spacing: 2px;
        }
        p { color: #00aa00; }
        a { 
            color: #00ff00; 
            text-decoration: none;
            border-bottom: 1px solid #00ff00;
            transition: all 0.3s ease;
        }
        a:hover { 
            color: #00aa00; 
            text-shadow: 0 0 5px rgba(0, 255, 0, 0.5);
            border-color: #00aa00;
        }
        .error-line {
            color: #ff5555;
            margin: 10px 0;
            font-size: 1.1em;
            animation: blink 1s infinite;
        }
        @keyframes blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
        }
        .prompt {
            color: #008800;
            font-size: 0.9em;
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="error-line">$ SYSTEM ERROR DETECTED</div>
        <h2>ERROR: SYSTEM FAILURE</h2>
        <p>${json.message || "Unable to fetch files. Please check the folder ID or API token."}</p>
        <p class="prompt">Possible issues: Invalid API token, incorrect folder ID, or GoFile API restrictions.</p>
        <p class="prompt" style="margin-top: 20px;">
            <a href="/">$ cd /</a>
        </p>
        <div class="prompt" style="margin-top: 30px;">$ Waiting for command...</div>
    </div>
</body>
</html>
            `, { status: 500, headers: { "Content-Type": "text/html" } });
        }

        await makeFolderPrivate(folderId);
        
        let parentFolderLink = folderId !== ROOT_FOLDER_ID && json.data.parentFolder
            ? `<div class="terminal-line"><a href="/?folder=${json.data.parentFolder}">$ cd ..</a></div>` 
            : "";

        // Filter folders and files
        const children = Object.values(json.data.children || {});
        const folders = children.filter(f => f.type === "folder");
        const files = children.filter(f => f.type !== "folder");

        // Sort folders by modified date (newest first)
        folders.sort((a, b) => b.modTime - a.modTime);
        // Sort files by modified date (newest first)
        files.sort((a, b) => b.modTime - a.modTime);

        // Generate folder rows
        let folderRows = folders.map(folder => `
            <tr>
                <td>📁 <a href="/?folder=${folder.id}" class="file-link">${folder.name}</a></td>
                <td>DIR</td>
                <td>-</td>
                <td class="date-cell">${formatModTime(folder.modTime)}</td>
            </tr>`).join("");

        // Generate file rows
        let fileRows = files.map(file => {
            const downloadLink = `/download/${encodeURIComponent(file.name)}?folder=${folderId}`;
            
            return `
            <tr>
                <td>${getFileIcon(file.name)} <a href="${downloadLink}" class="file-link">${file.name}</a></td>
                <td>${formatFileSize(file.size)}</td>
                <td>${file.mimetype || getMimeType(file.name)}</td>
                <td class="date-cell">${formatModTime(file.modTime)}<br><small style="color: #008800;">Downloads: ${file.downloadCount || 0}</small></td>
            </tr>`;
        }).join("");

        return new Response(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>$ Sundarans Private Files - ${folderId}</title>
    <link rel="icon" href="https://raw.githubusercontent.com/developeranaz/gofile-to-cloudflare-index/refs/heads/main/.images/1747059739966.png" type="image/png">
    <style>
        @font-face {
            font-family: 'Terminal';
            src: url('https://fonts.cdnfonts.com/css/cascadia-code');
        }
        * { 
            margin: 0; 
            padding: 0; 
            box-sizing: border-box; 
        }
        body {
            font-family: 'Terminal', 'Cascadia Code', 'Courier New', monospace;
            background-color: #0a0a0a;
            background-image: 
                linear-gradient(rgba(0, 255, 0, 0.02) 1px, transparent 1px),
                linear-gradient(90deg, rgba(0, 255, 0, 0.02) 1px, transparent 1px);
            background-size: 20px 20px;
            color: #00ff00;
            padding: 20px;
            line-height: 1.6;
            position: relative;
            overflow-x: hidden;
        }
        body::before {
            content: '';
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: 
                repeating-linear-gradient(
                    0deg,
                    rgba(0, 255, 0, 0.03) 0px,
                    rgba(0, 255, 0, 0.03) 1px,
                    transparent 1px,
                    transparent 2px
                ),
                radial-gradient(circle at 20% 50%, rgba(0, 255, 0, 0.05) 0%, transparent 50%),
                radial-gradient(circle at 80% 20%, rgba(0, 255, 0, 0.03) 0%, transparent 50%);
            pointer-events: none;
            z-index: -1;
            animation: scan 10s linear infinite;
        }
        @keyframes scan {
            0% { background-position: 0 0; }
            100% { background-position: 0 20px; }
        }
        h2 {
            color: #00ff00;
            font-size: 2.2em;
            margin-bottom: 10px;
            font-weight: normal;
            text-shadow: 0 0 10px rgba(0, 255, 0, 0.5);
            letter-spacing: 2px;
            border-bottom: 1px solid #00ff00;
            padding-bottom: 10px;
            position: relative;
        }
        h2::before {
            content: '$';
            color: #008800;
            margin-right: 10px;
        }
        .shared-section { 
            margin-bottom: 20px; 
        }
        #sharedInput {
            max-height: 0;
            overflow: hidden;
            transition: max-height 0.3s ease;
        }
        #sharedInput.visible { max-height: 150px; }
        .shared-button {
            padding: 10px 20px;
            font-size: 16px;
            background-color: #002200;
            color: #00ff00;
            border: 1px solid #00ff00;
            border-radius: 2px;
            cursor: pointer;
            transition: all 0.3s ease;
            font-family: 'Terminal', monospace;
            letter-spacing: 1px;
        }
        .shared-button:hover { 
            background-color: #003300;
            box-shadow: 0 0 15px rgba(0, 255, 0, 0.5);
            transform: translateY(-1px);
        }
        input {
            width: 100%;
            padding: 12px;
            margin-bottom: 10px;
            font-size: 16px;
            background-color: rgba(0, 20, 0, 0.8);
            color: #00ff00;
            border: 1px solid #00aa00;
            border-radius: 2px;
            transition: all 0.3s ease;
            font-family: 'Terminal', monospace;
            letter-spacing: 1px;
        }
        input::placeholder {
            color: #008800;
        }
        input:focus {
            outline: none;
            border-color: #00ff00;
            box-shadow: 0 0 10px rgba(0, 255, 0, 0.5);
            background-color: rgba(0, 30, 0, 0.8);
        }
        button {
            padding: 10px 20px;
            font-size: 16px;
            background-color: #002200;
            color: #00ff00;
            border: 1px solid #00ff00;
            border-radius: 2px;
            cursor: pointer;
            transition: all 0.3s ease;
            margin: 5px;
            font-family: 'Terminal', monospace;
            letter-spacing: 1px;
            position: relative;
            overflow: hidden;
        }
        button:hover { 
            background-color: #003300;
            box-shadow: 0 0 15px rgba(0, 255, 0, 0.5);
            transform: translateY(-1px);
        }
        button:active {
            transform: translateY(1px);
        }
        .container {
            max-width: 1000px;
            margin: 0 auto;
            background-color: rgba(10, 20, 10, 0.95);
            padding: 20px;
            border-radius: 4px;
            border: 1px solid #00ff00;
            box-shadow: 
                0 0 20px rgba(0, 255, 0, 0.3),
                inset 0 0 30px rgba(0, 255, 0, 0.1);
            position: relative;
            overflow-x: hidden;
        }
        .container::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            border: 1px solid rgba(0, 255, 0, 0.1);
            pointer-events: none;
            animation: pulse 2s infinite;
        }
        @keyframes pulse {
            0%, 100% { opacity: 0.3; }
            50% { opacity: 0.7; }
        }
        table {
            width: 100%;
            border-collapse: collapse;
            background: rgba(0, 20, 0, 0.5);
            border-radius: 2px;
            overflow: hidden;
            margin-bottom: 20px;
            border: 1px solid #00aa00;
            table-layout: fixed;
        }
        th, td {
            padding: 12px 8px;
            text-align: left;
            border-bottom: 1px solid #003300;
            word-wrap: break-word;
            overflow: hidden;
        }
        th {
            background-color: rgba(0, 40, 0, 0.8);
            color: #00ff00;
            font-weight: normal;
            letter-spacing: 1px;
            border-right: 1px solid #003300;
        }
        th:last-child {
            border-right: none;
        }
        td { 
            color: #00cc00; 
            border-right: 1px solid #003300;
            font-size: 0.95em;
        }
        td:last-child {
            border-right: none;
        }
        tr:hover {
            background-color: rgba(0, 60, 0, 0.3);
        }
        a {
            color: #00ff00;
            text-decoration: none;
            transition: all 0.3s ease;
            border-bottom: 1px dotted #00ff00;
            word-break: break-word;
        }
        a:hover { 
            color: #00aa00; 
            text-shadow: 0 0 5px rgba(0, 255, 0, 0.5);
            border-bottom: 1px solid #00ff00;
        }
        .file-link {
            color: #00ccff;
        }
        .file-link:hover {
            color: #00aacc;
        }
        .deploy-id {
            margin-bottom: 15px;
            color: #008800;
            font-size: 0.9em;
            padding: 5px 10px;
            background: rgba(0, 30, 0, 0.5);
            border: 1px solid #008800;
            display: inline-block;
            border-radius: 2px;
        }
        .logout {
            display: inline-block;
            margin-top: 10px;
            padding: 8px 16px;
            background-color: #330000;
            color: #ff5555;
            border-radius: 2px;
            cursor: pointer;
            border: 1px solid #ff5555;
            font-family: 'Terminal', monospace;
            transition: all 0.3s ease;
        }
        .logout:hover { 
            background-color: #440000;
            box-shadow: 0 0 10px rgba(255, 85, 85, 0.5);
        }
        footer {
            text-align: center;
            padding: 15px;
            background: rgba(0, 30, 0, 0.5);
            border-radius: 2px;
            margin-top: 20px;
            border-top: 1px solid #008800;
        }
        footer a {
            margin: 0 15px;
            color: #00cc00;
            font-size: 0.9em;
        }
        footer a:hover { color: #00ff00; }
        .modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            z-index: 1000;
        }
        .modal-content {
            background: rgba(10, 20, 10, 0.95);
            margin: 15% auto;
            padding: 25px;
            width: 80%;
            max-width: 500px;
            border-radius: 4px;
            position: relative;
            color: #00ff00;
            border: 1px solid #00ff00;
            box-shadow: 0 0 30px rgba(0, 255, 0, 0.5);
        }
        .modal-content h3 {
            color: #00ff00;
            margin-bottom: 15px;
            border-bottom: 1px solid #00ff00;
            padding-bottom: 10px;
        }
        .modal-content a { color: #00ccff; }
        .modal-content a:hover { color: #00aacc; }
        .close {
            position: absolute;
            top: 10px;
            right: 15px;
            color: #008800;
            font-size: 28px;
            cursor: pointer;
            transition: color 0.3s ease;
        }
        .close:hover { color: #00ff00; }
        .stats-bar {
            display: flex;
            gap: 20px;
            margin: 15px 0;
            flex-wrap: wrap;
        }
        .stat-item {
            background: rgba(0, 40, 0, 0.5);
            padding: 10px 15px;
            border-radius: 2px;
            min-width: 150px;
            border: 1px solid #008800;
        }
        .stat-value {
            font-size: 1.2em;
            font-weight: bold;
            color: #00ff00;
            text-shadow: 0 0 5px rgba(0, 255, 0, 0.5);
        }
        .terminal-line {
            color: #008800;
            margin-bottom: 10px;
            font-size: 0.9em;
        }
        .search-container {
            position: relative;
            margin-bottom: 20px;
        }
        #search {
            padding-left: 12px;
            background-color: rgba(0, 20, 0, 0.8);
        }
        /* Fixed table column widths */
        th:nth-child(1), td:nth-child(1) { width: 45%; }
        th:nth-child(2), td:nth-child(2) { width: 15%; }
        th:nth-child(3), td:nth-child(3) { width: 20%; }
        th:nth-child(4), td:nth-child(4) { width: 20%; }
        
        .date-cell {
            font-size: 0.85em;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        
        @media (max-width: 600px) {
            .container {
                padding: 15px;
                overflow-x: auto;
            }
            table {
                display: block;
                width: 100%;
                overflow-x: auto;
                white-space: nowrap;
            }
            th:nth-child(1), td:nth-child(1) { width: 200px; min-width: 200px; }
            th:nth-child(2), td:nth-child(2) { width: 80px; min-width: 80px; }
            th:nth-child(3), td:nth-child(3) { width: 100px; min-width: 100px; }
            th:nth-child(4), td:nth-child(4) { width: 150px; min-width: 150px; }
            .modal-content { width: 90%; margin: 20% auto; }
            body { padding: 10px; }
            .shared-button, button, .logout { font-size: 14px; padding: 8px 16px; }
            input { font-size: 14px; }
            .stats-bar { gap: 10px; }
            .stat-item { min-width: 120px; }
            .date-cell {
                font-size: 0.8em;
            }
        }
        .blink {
            animation: blink 1s infinite;
        }
        @keyframes blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        .cursor {
            display: inline-block;
            width: 8px;
            height: 16px;
            background-color: #00ff00;
            animation: cursor-blink 1s infinite;
            margin-left: 2px;
            vertical-align: middle;
        }
        @keyframes cursor-blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0; }
        }
    </style>
</head>
<body>
    <div class="container">
        <h2>SUNDARANS PRIVATE FILES<span class="cursor"></span></h2>
        
        <div class="terminal-line">$ Initializing file system...</div>
        <div class="terminal-line">$ Connected to folder: ${folderId}</div>
        
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
            <button class="shared-button" onclick="toggleSharedInput()">$ SHARED/PUBLIC ACCESS</button>
            <div id="sharedInput">
                <div class="terminal-line">$ Enter URL or Folder ID:</div>
                <input type="text" id="folderInput" placeholder="A0LCPx or https://gofile.io/d/A0LCPx">
                <button onclick="openSharedFolder()">ACCESS FOLDER</button>
            </div>
        </div>
        
        ${parentFolderLink}
        <div class="terminal-line">$ Current folder code: <span class="deploy-id">${json.data.code || 'N/A'}</span></div>
        ${AUTHENTICATION === "true" ? '<button class="logout" onclick="logout()">$ LOGOUT</button>' : ''}
        
        <div class="search-container">
            <input type="text" id="search" placeholder="Enter search pattern...">
        </div>
        
        <div class="terminal-line">$ File listing:</div>
        <table id="fileTable">
            <thead>
                <tr>
                    <th>NAME</th>
                    <th>SIZE</th>
                    <th>TYPE</th>
                    <th>MODIFIED</th>
                </tr>
            </thead>
            <tbody id="fileBody">
                ${folderRows}
                ${fileRows}
            </tbody>
        </table>
        
        <div class="terminal-line">$ Ready for commands...</div>
        
        <footer>
            <a href="#" onclick="openModal('privacy')">$ privacy</a> |
            <a href="#" onclick="openModal('usage')">$ usage</a> |
            <a href="#" onclick="openModal('report')">$ report</a>
        </footer>
    </div>
    
    <div id="privacyModal" class="modal">
        <div class="modal-content">
            <span class="close" onclick="closeModal('privacy')">×</span>
            <h3>$ PRIVACY POLICY</h3>
            <p>> This service displays GoFile folder contents. We don't store any personal data.</p>
            <div class="terminal-line">$ End of policy</div>
        </div>
    </div>
    
    <div id="usageModal" class="modal">
        <div class="modal-content">
            <span class="close" onclick="closeModal('usage')">×</span>
            <h3>$ USAGE WARNING</h3>
            <p>> You are fully responsible for the content you share.</p>
            <div class="terminal-line">$ Proceed with caution</div>
        </div>
    </div>
    
    <div id="reportModal" class="modal">
        <div class="modal-content">
            <span class="close" onclick="closeModal('report')">×</span>
            <h3>$ REPORT ABUSE</h3>
            <p>> Report issues to <a href="mailto:abuse@gofile.io">abuse@gofile.io</a></p>
            <div class="terminal-line">$ Report system ready</div>
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

        // Add typing effect to search placeholder
        const searchInput = document.getElementById('search');
        const placeholders = [
            'Enter search pattern...',
            'Search files...',
            'Filter by name...',
            'Find files...'
        ];
        let placeholderIndex = 0;
        let charIndex = 0;
        let isDeleting = false;
        
        function typeEffect() {
            const currentPlaceholder = placeholders[placeholderIndex];
            
            if (isDeleting) {
                searchInput.placeholder = currentPlaceholder.substring(0, charIndex - 1);
                charIndex--;
            } else {
                searchInput.placeholder = currentPlaceholder.substring(0, charIndex + 1);
                charIndex++;
            }
            
            if (!isDeleting && charIndex === currentPlaceholder.length) {
                isDeleting = true;
                setTimeout(typeEffect, 2000);
            } else if (isDeleting && charIndex === 0) {
                isDeleting = false;
                placeholderIndex = (placeholderIndex + 1) % placeholders.length;
                setTimeout(typeEffect, 500);
            } else {
                setTimeout(typeEffect, isDeleting ? 50 : 100);
            }
        }
        
        // Start typing effect
        typeEffect();
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
