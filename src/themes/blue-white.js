const GOFILE_API_BASE = "https://api.gofile.io/contents/";
const AUTH_TOKEN = "Bearer THEGOFILETOKEN"; // Replace with your API Key
const THEROOTFOLDERID = "THEROOTFOLDERID"; // Replace your custom or root folder ID here

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

function getFileIcon(filename, isFolder = false) {
    if (isFolder) return 'fas fa-folder';
    
    const ext = filename.split('.').pop().toLowerCase();
    const icons = {
        // Archives
        'zip': 'fas fa-file-archive', 'rar': 'fas fa-file-archive', '7z': 'fas fa-file-archive', 
        'tar': 'fas fa-file-archive', 'gz': 'fas fa-file-archive', 'bz2': 'fas fa-file-archive',
        // Documents
        'pdf': 'fas fa-file-pdf', 'doc': 'fas fa-file-word', 'docx': 'fas fa-file-word',
        'xls': 'fas fa-file-excel', 'xlsx': 'fas fa-file-excel', 'ppt': 'fas fa-file-powerpoint',
        'pptx': 'fas fa-file-powerpoint', 'txt': 'fas fa-file-alt', 'md': 'fas fa-file-alt',
        // Images
        'jpg': 'fas fa-file-image', 'jpeg': 'fas fa-file-image', 'png': 'fas fa-file-image',
        'gif': 'fas fa-file-image', 'svg': 'fas fa-file-image', 'webp': 'fas fa-file-image',
        'bmp': 'fas fa-file-image',
        // Audio
        'mp3': 'fas fa-file-audio', 'wav': 'fas fa-file-audio', 'ogg': 'fas fa-file-audio',
        'flac': 'fas fa-file-audio', 'aac': 'fas fa-file-audio',
        // Video
        'mp4': 'fas fa-file-video', 'mkv': 'fas fa-file-video', 'avi': 'fas fa-file-video',
        'mov': 'fas fa-file-video', 'wmv': 'fas fa-file-video', 'flv': 'fas fa-file-video',
        'webm': 'fas fa-file-video',
        // Code
        'js': 'fas fa-file-code', 'html': 'fas fa-file-code', 'css': 'fas fa-file-code',
        'json': 'fas fa-file-code', 'php': 'fas fa-file-code', 'py': 'fas fa-file-code',
        'java': 'fas fa-file-code', 'c': 'fas fa-file-code', 'cpp': 'fas fa-file-code',
        'h': 'fas fa-file-code',
        // Executables
        'exe': 'fas fa-cog', 'msi': 'fas fa-cog', 'dmg': 'fas fa-cog',
        'pkg': 'fas fa-cog', 'deb': 'fas fa-cog', 'rpm': 'fas fa-cog',
        // Other
        'iso': 'fas fa-compact-disc', 'csv': 'fas fa-file-csv', 'xml': 'fas fa-file-code',
        'sql': 'fas fa-database', 'db': 'fas fa-database'
    };
    return icons[ext] || 'fas fa-file';
}

async function handleRequest(event) {
    const url = new URL(event.request.url);
    const folderId = url.searchParams.get("folder") || THEROOTFOLDERID; // Changed to use constant

    if (url.pathname === "/") {
        await makeFolderPrivate(folderId);
        const json = await fetchFileList(folderId);
        if (json.status !== "ok") return new Response("Error fetching files", { status: 500 });

        let parentFolderLink = folderId !== THEROOTFOLDERID // Changed to use constant
            ? `<a href="/?folder=${json.data.parentFolder}" class="folder-link">
                 <i class="fas fa-folder-open"></i> Parent Folder
               </a>` 
            : "";

        let folders = Object.values(json.data.children).filter(f => f.type === "folder").map(folder => ({
            name: folder.name,
            id: folder.id,
            modTime: formatModTime(folder.createTime)
        })).map(folder => `
            <tr data-name="${folder.name.toLowerCase()}">
                <td><i class="${getFileIcon('', true)}"></i></td>
                <td><a href="/?folder=${folder.id}" class="folder-link">${folder.name}</a></td>
                <td class="file-size">-</td>
                <td class="file-date">${folder.modTime}</td>
            </tr>`
        ).join("");

        let files = Object.values(json.data.children).filter(f => f.type !== "folder").map(file => ({
            name: file.name,
            size: formatFileSize(file.size),
            modTime: formatModTime(file.modTime),
            link: `/download/${encodeURIComponent(file.name)}?folder=${folderId}`,
            icon: getFileIcon(file.name),
            modTimeSort: file.modTime
        })).map(file => `
            <tr data-name="${file.name.toLowerCase()}" data-time="${file.modTimeSort}">
                <td><i class="${file.icon}"></i></td>
                <td><a href="${file.link}" class="file-link">${file.name}</a></td>
                <td class="file-size">${file.size}</td>
                <td class="file-date">${file.modTime}</td>
            </tr>`
        ).join("");

        return new Response(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>File Index</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
            <style>
                :root {
                    --primary-color: #4a6fa5;
                    --secondary-color: #166088;
                    --background-color: #f8f9fa;
                    --text-color: #333;
                    --border-color: #ddd;
                    --hover-color: #e9ecef;
                }
                
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    line-height: 1.6;
                    color: var(--text-color);
                    background-color: var(--background-color);
                    padding: 20px;
                    max-width: 1200px;
                    margin: 0 auto;
                }
                
                h2 {
                    color: var(--primary-color);
                    margin-bottom: 20px;
                    border-bottom: 2px solid var(--primary-color);
                    padding-bottom: 10px;
                }
                
                .folder-link, .file-link {
                    color: var(--secondary-color);
                    text-decoration: none;
                    transition: color 0.2s;
                }
                
                .folder-link:hover, .file-link:hover {
                    color: var(--primary-color);
                    text-decoration: underline;
                }
                
                #search {
                    width: 100%;
                    padding: 12px 15px;
                    margin-bottom: 20px;
                    border: 2px solid var(--border-color);
                    border-radius: 6px;
                    font-size: 16px;
                    box-sizing: border-box;
                    transition: all 0.2s;
                }
                
                #search:focus {
                    outline: none;
                    border-color: var(--primary-color);
                    box-shadow: 0 0 0 3px rgba(74, 111, 165, 0.1);
                }
                
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 20px;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                    background-color: white;
                    border-radius: 6px;
                    overflow: hidden;
                }
                
                th, td {
                    padding: 12px 15px;
                    text-align: left;
                    border-bottom: 1px solid var(--border-color);
                }
                
                th {
                    background-color: var(--primary-color);
                    color: white;
                    font-weight: 600;
                }
                
                tr:hover {
                    background-color: var(--hover-color);
                }
                
                .file-size {
                    font-family: monospace;
                    color: #666;
                }
                
                .file-date {
                    white-space: nowrap;
                }
                
                .fa-folder {
                    color: #4a6fa5;
                }
                
                .fa-file-pdf { color: #e74c3c; }
                .fa-file-archive { color: #f39c12; }
                .fa-file-video { color: #3498db; }
                .fa-file-image { color: #2ecc71; }
                .fa-file-code { color: #9b59b6; }
                .fa-file-audio { color: #e67e22; }
                
                #deployId {
                    font-family: monospace;
                    background-color: #eee;
                    padding: 2px 5px;
                    border-radius: 3px;
                }
                
                @media (max-width: 768px) {
                    body { padding: 15px; }
                    th, td { padding: 10px; }
                    .file-date { display: none; }
                }
            </style>
        </head>
        <body>
            <h2><i class="fas fa-folder-open"></i> File Index</h2>
            ${parentFolderLink}
            <div class="stats">
                <p>Deploy ID: <span id="deployId"></span></p>
            </div>
            <input type="text" id="search" placeholder="Search files...">
            <table id="fileTable">
                <thead>
                    <tr>
                        <th width="40px"></th>
                        <th>Name</th>
                        <th width="120px">Size</th>
                        <th width="180px">Modified</th>
                    </tr>
                </thead>
                <tbody id="fileBody">
                    ${folders}
                    ${files}
                </tbody>
            </table>
            <script>
                document.addEventListener("DOMContentLoaded", () => {
                    const searchInput = document.getElementById('search');
                    const fileBody = document.getElementById('fileBody');
                    
                    // Initial sorting by modification time
                    const rows = Array.from(fileBody.children);
                    rows.sort((a, b) => {
                        const timeA = parseInt(a.dataset.time) || 0;
                        const timeB = parseInt(b.dataset.time) || 0;
                        return timeB - timeA;
                    });
                    fileBody.innerHTML = '';
                    rows.forEach(row => fileBody.appendChild(row));
                    
                    // Search functionality
                    searchInput.addEventListener('input', function() {
                        const term = this.value.trim().toLowerCase();
                        let visibleCount = 0;
                        
                        Array.from(fileBody.children).forEach(row => {
                            const match = row.dataset.name.includes(term);
                            row.style.display = match ? '' : 'none';
                            if (match) visibleCount++;
                        });
                        
                        updateFileCount(visibleCount);
                    });
                    
                    function updateFileCount(visible) {
                        const total = fileBody.children.length;
                        searchInput.placeholder = visible === total ?
                            \`Search \${total} items...\` :
                            \`Showing \${visible} of \${total} items...\`;
                    }
                    
                    // Random deploy ID
                    document.getElementById('deployId').textContent = 
                        Math.random().toString(36).substring(2, 10);
                });
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

        const headers = {
            "authority": new URL(file.link).hostname,
            "accept": "*/*",
            "referer": "https://gofile.io/",
            "cookie": `accountToken=${AUTH_TOKEN.split(" ")[1]}`,
            "user-agent": event.request.headers.get("user-agent") || "Mozilla/5.0"
        };

        const rangeHeader = event.request.headers.get("Range");
        if (rangeHeader) headers["Range"] = rangeHeader;
        
        try {
            const fileResponse = await fetch(file.link, { headers });
            const responseHeaders = new Headers(fileResponse.headers);
            responseHeaders.set("Content-Disposition", `attachment; filename="${fileName}"`);
            responseHeaders.set("Access-Control-Expose-Headers", "Content-Range, Content-Length");
            return new Response(fileResponse.body, {
                status: fileResponse.status,
                headers: responseHeaders
            });
        } catch (error) {
            return new Response(`Download failed: ${error.message}`, { status: 500 });
        }
    }
    return new Response("Not Found", { status: 404 });
}

addEventListener("fetch", event => event.respondWith(handleRequest(event)));
