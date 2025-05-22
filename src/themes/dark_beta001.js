// THIS IS A BETA VERSION OF CODE AND MAY CONTAIN ERROR IN NEW FEATURES
const GOFILE_API_BASE = "https://api.gofile.io/contents/";
const AUTH_TOKEN = "Bearer THEGOFILETOKEN"; // Replace with your API Key
const ROOT_FOLDER_ID = "THEROOTFOLDERID"; // Replace with your custom or root folder ID here
const AUTHENTICATION = "true"; // Replace with "true" or "false"
const OPTIONAL_USER = "THESTRONG_USER"; // Replace with your custom username
const OPTIONAL_PASS = "THESTRONG_PASSWORD"; // Replace with your custom password

async function fetchFileList(folderId) {
    try {
        const response = await fetch(`${GOFILE_API_BASE}${folderId}?wt=4fd6sg89d7s6&contentFilter=&page=1&pageSize=1000&sortField=createTime&sortDirection=-1`, {
            headers: { "authorization": AUTH_TOKEN }
        });
        if (!response.ok) {
            throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        if (data.status !== "ok") {
            throw new Error(`API error: ${data.message || "Unknown error"}`);
        }
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
                "Authorization": AUTH_TOKEN
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
    if (['mp4', 'mkv', 'avi', 'mov'].includes(ext)) return '🎥'; // Video icon
    if (['zip', 'rar', '7z', 'tar'].includes(ext)) return '📦'; // Compressed file icon
    return '📄'; // Default file icon
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

async function handleRequest(event) {
    const url = new URL(event.request.url);
    const folderId = url.searchParams.get("folder") || ROOT_FOLDER_ID;

    if (url.pathname === "/" && !url.searchParams.get("folder") && AUTHENTICATION === "true") {
        if (!checkAuth(event.request)) {
            return new Response(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>GoFile Index - Login</title>
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
        <h2>GoFile Index - Login</h2>
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
                    "WWW-Authenticate": 'Basic realm="GoFile Index"',
                    "Content-Type": "text/html"
                }
            });
        }
    }

    if (url.pathname === "/") {
        const json = await fetchFileList(folderId);
        if (json.status !== "ok") {
            return new Response(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>GoFile Index - Error</title>
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
        let parentFolderLink = folderId !== ROOT_FOLDER_ID 
            ? `<a href="/?folder=${json.data.parentFolder}">← Back to Parent Folder</a><br>` 
            : "";

        let folders = Object.values(json.data.children).filter(f => f.type === "folder").map(folder =>
            `<tr><td colspan="3"><a href="/?folder=${folder.id}">📁 ${folder.name}</a></td></tr>`
        ).join("");

        let files = Object.values(json.data.children).filter(f => f.type !== "folder").map(file => ({
            name: file.name,
            icon: getFileIcon(file.name),
            size: formatFileSize(file.size),
            modTime: formatModTime(file.modTime),
            link: `/download/${encodeURIComponent(file.name)}?folder=${folderId}`,
            time: new Date(file.modTime * 1000).toISOString()
        })).map(file => `
            <tr data-time="${file.time}">
                <td>${file.icon} <a href="${file.link}">${file.name}</a></td>
                <td>${file.size}</td>
                <td>${file.modTime}</td>
            </tr>`
        ).join("");

        return new Response(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>GoFile Index - ${folderId}</title>
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
        <h2>GoFile Index</h2>
        <div class="shared-section">
            <button class="shared-button" onclick="toggleSharedInput()">Shared/Public</button>
            <div id="sharedInput">
                <input type="text" id="folderInput" placeholder="Enter URL or Folder ID (e.g. A0LCPx)">
                <button onclick="openSharedFolder()">View/Index</button>
            </div>
        </div>
        ${parentFolderLink}
        <p class="deploy-id">Deploy ID: <span id="deployId"></span></p>
        ${AUTHENTICATION === "true" ? '<a class="logout" onclick="logout()">Log Out</a>' : ''}
        <input type="text" id="search" placeholder="Search files...">
        <table id="fileTable">
            <thead>
                <tr>
                    <th>File Name</th>
                    <th>Size</th>
                    <th>Modification Time</th>
                </tr>
            </thead>
            <tbody id="fileBody">
                ${folders}
                ${files}
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
            <p>This service does not collect or store personal data beyond what’s needed to display GoFile.io folder contents.</p>
        </div>
    </div>
    <div id="usageModal" class="modal">
        <div class="modal-content">
            <span class="close" onclick="closeModal('usage')">×</span>
            <h3>Usage Warning</h3>
            <p>Do not share illegal content. You are fully responsible for your actions.</p>
        </div>
    </div>
    <div id="reportModal" class="modal">
        <div class="modal-content">
            <span class="close" onclick="closeModal('report')">×</span>
            <h3>Report Abuse</h3>
            <p>Report issues to <a href="mailto:abuse@gofile.io">abuse@gofile.io</a> with the folder ID.</p>
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
            rows.sort((a, b) => {
                let dateA = new Date(a.getAttribute("data-time"));
                let dateB = new Date(b.getAttribute("data-time"));
                return dateB - dateA;
            });
            tbody.innerHTML = "";
            rows.forEach(row => tbody.appendChild(row));
            document.getElementById("deployId").textContent = Math.random().toString(36).substring(2, 10);
        });

        document.getElementById("search").addEventListener("input", function() {
            let input = this.value.toLowerCase();
            let rows = document.querySelectorAll("#fileTable tbody tr");
            rows.forEach(row => {
                let fileName = row.textContent.toLowerCase();
                row.style.display = fileName.includes(input) ? "" : "none";
            });
        });

        function openModal(type) { document.getElementById(type + 'Modal').style.display = 'block'; }
        function closeModal(type) { document.getElementById(type + 'Modal').style.display = 'none'; }
    </script>
</body>
</html>
        `, { headers: { "Content-Type": "text/html" } });
    }

    if (url.pathname.startsWith("/download/")) {
        const fileName = decodeURIComponent(url.pathname.replace("/download/", ""));
        const json = await fetchFileList(folderId);
        if (json.status !== "ok") {
            return new Response(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>GoFile Index - Error</title>
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
        const file = Object.values(json.data.children).find(f => f.name === fileName);
        if (!file) return new Response("File not found", { status: 404 });

        let headers = {
            "authority": new URL(file.link).hostname,
            "accept": "*/*",
            "referer": "https://gofile.io/",
            "cookie": `accountToken=${AUTH_TOKEN.split(" ")[1]}`,
            "user-agent": event.request.headers.get("user-agent") || "Mozilla/5.0"
        };

        let rangeHeader = event.request.headers.get("Range");
        if (rangeHeader) headers["Range"] = rangeHeader;
        const fileResponse = await fetch(file.link, { headers });
        let responseHeaders = new Headers(fileResponse.headers);
        responseHeaders.set("Content-Disposition", `attachment; filename="${fileName}"`);
        responseHeaders.set("Access-Control-Expose-Headers", "Content-Range, Content-Length");
        return new Response(fileResponse.body, {
            status: fileResponse.status,
            headers: responseHeaders
        });
    }
    return new Response("Not Found", { status: 404 });
}

addEventListener("fetch", event => event.respondWith(handleRequest(event)));
