// THIS IS A BETA VERSION OF CODE AND MAY CONTAIN ERROR IN NEW FEATURES
const GOFILE_API_BASE = "https://api.gofile.io/contents/";
const AUTH_TOKEN = "Bearer THEGOFILETOKEN"; // Replace with your API Key
const ROOT_FOLDER_ID = "THEROOTFOLDERID"; // Replace your custom or root folder ID here

async function fetchFileList(folderId) {
    const response = await fetch(`${GOFILE_API_BASE}${folderId}?wt=4fd6sg89d7s6&contentFilter=&page=1&pageSize=1000&sortField=createTime&sortDirection=-1`, {
        headers: { "authorization": AUTH_TOKEN }
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

async function handleRequest(event) {
    const url = new URL(event.request.url);
    const folderId = url.searchParams.get("folder") || ROOT_FOLDER_ID;

    if (url.pathname === "/") {
        await makeFolderPrivate(folderId);
        const json = await fetchFileList(folderId);
        if (json.status !== "ok") return new Response("Error fetching files", { status: 500 });

        let parentFolderLink = folderId !== ROOT_FOLDER_ID 
            ? `<a href="/?folder=${json.data.parentFolder}">.. (Parent Folder)</a><br>` 
            : "";
        
        let folders = Object.values(json.data.children).filter(f => f.type === "folder").map(folder =>
            `<tr><td colspan="3"><a href="/?folder=${folder.id}">&#128193; ${folder.name}</a></td></tr>`
        ).join("");

        let files = Object.values(json.data.children).filter(f => f.type !== "folder").map(file => ({
            name: file.name,
            size: formatFileSize(file.size),
            modTime: formatModTime(file.modTime),
            link: `/download/${encodeURIComponent(file.name)}?folder=${folderId}`
        })).map(file => `
            <tr data-name="${file.name.toLowerCase()}">
                <td><a href="${file.link}">${file.name}</a></td>
                <td>${file.size}</td>
                <td>${file.modTime}</td>
            </tr>`
        ).join("");

        return new Response(`
<!DOCTYPE html>
<html>
<head>
    <title>File Index</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        input { width: 100%; padding: 10px; margin-bottom: 10px; font-size: 16px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .shared-section { margin-bottom: 15px; }
        #sharedInput { max-height: 0; overflow: hidden; transition: max-height 0.3s ease; }
        #sharedInput.visible { max-height: 100px; }
        .shared-button { margin-bottom: 10px; padding: 8px 15px; cursor: pointer; }
    </style>
</head>
<body>
    <h2>File Index</h2>
    <div class="shared-section">
        <button class="shared-button" onclick="toggleSharedInput()">Shared/Public</button>
        <div id="sharedInput">
            <input type="text" id="folderInput" placeholder="Enter URL or Folder ID (e.g. A4CCPt)">
            <button onclick="openSharedFolder()">View/Index</button>
        </div>
    </div>
    ${parentFolderLink}
    <p>Deploy ID: <span id="deployId"></span></p>
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
        });

        document.getElementById("search").addEventListener("input", function() {
            let input = this.value.toLowerCase();
            let rows = document.querySelectorAll("#fileTable tbody tr");
            rows.forEach(row => {
                let fileName = row.textContent.toLowerCase();
                row.style.display = fileName.includes(input) ? "" : "none";
            });
        });

        document.getElementById("deployId").textContent = Math.random().toString(36).substring(2, 10);
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
        responseHeaders.set("Content-Disposition", `attachment; filename=\"${fileName}\"`);
        responseHeaders.set("Access-Control-Expose-Headers", "Content-Range, Content-Length");
        return new Response(fileResponse.body, {
            status: fileResponse.status,
            headers: responseHeaders
        });
    }
    return new Response("Not Found", { status: 404 });
}

addEventListener("fetch", event => event.respondWith(handleRequest(event)));
