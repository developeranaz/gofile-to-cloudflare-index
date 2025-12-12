async function fetchFileList(folderId) {
    const response = await fetch(`${GOFILE_API_BASE}${folderId}?wt=4fd6sg89d7s6&contentFilter=&page=1&pageSize=1000&sortField=createTime&sortDirection=-1`, {
        headers: { "authorization": AUTH_TOKEN ,
                   "x-website-token": "4fd6sg89d7s6" // If this line is not included, it will make this shit mad.
                 }
    });
    return response.json();
}

async function makeFolderPrivate(folderId) {
    await fetch(`${GOFILE_API_BASE}${folderId}/update`, {
        method: "PUT",
        headers: {
            "User-Agent": "Mozilla/5.0",
            "Content-Type": "application/json",
            "Authorization": AUTH_TOKEN
        },
        body: JSON.stringify({ "attribute": "public", "attributeValue": false })
    });
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

async function handleRequest(event) {
    const url = new URL(event.request.url);
    const folderId = url.searchParams.get("folder") || ROOT_FOLDER_ID;

    if (url.pathname === "/") {
        await makeFolderPrivate(folderId);
        const json = await fetchFileList(folderId);
        if (json.status !== "ok") return new Response("Error fetching files", { status: 500 });

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
        body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f5f5f5; color: #333333; padding: 20px; line-height: 1.6; }
        h2 { color: #007bff; font-size: 2em; margin-bottom: 15px; }
        .shared-section { margin-bottom: 15px; }
        #sharedInput { max-height: 0; overflow: hidden; transition: max-height 0.3s ease; }
        #sharedInput.visible { max-height: 100px; }
        .shared-button { padding: 8px 15px; font-size: 16px; background-color: #007bff; color: #ffffff; border: none; border-radius: 8px; cursor: pointer; margin-bottom: 10px; }
        .shared-button:hover { background-color: #0056b3; }
        input { width: 100%; padding: 12px; margin-bottom: 10px; font-size: 16px; background-color: #ffffff; color: #333333; border: 1px solid #ccc; border-radius: 8px; }
        input:focus { outline: none; box-shadow: 0 0 5px #007bff; }
        button { padding: 8px 15px; font-size: 16px; background-color: #007bff; color: #ffffff; border: none; border-radius: 8px; cursor: pointer; }
        button:hover { background-color: #0056b3; }
        table { width: 100%; border-collapse: collapse; background: #ffffff; border-radius: 8px; overflow: hidden; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e0e0e0; }
        th { background-color: #f0f0f0; color: #007bff; }
        a { color: #007bff; text-decoration: none; }
        a:hover { opacity: 0.8; }
        .container { max-width: 900px; margin: 0 auto; }
        .deploy-id { margin-bottom: 15px; }
        footer { text-align: center; padding: 20px; background: #e0e0e0; border-radius: 10px; }
        footer a { margin: 0 10px; color: #007bff; }
        .modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; }
        .modal-content { background: #ffffff; margin: 15% auto; padding: 20px; width: 80%; max-width: 500px; border-radius: 10px; position: relative; box-shadow: 0 4px 10px rgba(0,0,0,0.2); }
        .close { position: absolute; top: 10px; right: 15px; color: #666; font-size: 24px; cursor: pointer; }
        .close:hover { color: #000; }
        @media (max-width: 600px) {
            table { display: block; overflow-x: auto; white-space: nowrap; }
            .modal-content { width: 95%; margin: 20% auto; }
            body { padding: 10px; }
            .container { padding: 0 10px; }
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
