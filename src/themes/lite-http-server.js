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
    return date.toISOString().replace("T", " ").slice(0, 19);
}

async function handleRequest(event) {
    const url = new URL(event.request.url);
    const folderId = url.searchParams.get("folder") || ROOT_FOLDER_ID; // Changed to use constant

    if (url.pathname === "/") {
        await makeFolderPrivate(folderId);
        const json = await fetchFileList(folderId);
        if (json.status !== "ok") return new Response("Error fetching files", { status: 500 });

        let parentFolderLink = folderId !== ROOT_FOLDER_ID // Changed to use constant
            ? `<tr><td><a href="/?folder=${json.data.parentFolder}">../</a></td><td>-</td><td>-</td></tr>`
            : "";

        let folders = Object.values(json.data.children).filter(f => f.type === "folder").map(folder =>
            `<tr>
                <td><a href="/?folder=${folder.id}">${folder.name}/</a></td>
                <td>${formatModTime(folder.modTime)}</td>
                <td>-</td>
            </tr>`
        ).join("");

        let files = Object.values(json.data.children).filter(f => f.type !== "folder").map(file => ({
            name: file.name,
            size: formatFileSize(file.size),
            modTime: formatModTime(file.modTime),
            link: `/download/${encodeURIComponent(file.name)}?folder=${folderId}`
        })).map(file => `
            <tr>
                <td><a href="${file.link}">${file.name}</a></td>
                <td>${file.modTime}</td>
                <td>${file.size}</td>
            </tr>`
        ).join("");

        return new Response(`<!DOCTYPE html>
<html>
<head>
    <title>Index of /</title>
    <style>
        body { font-family: monospace; background: #fff; color: #000; padding: 20px; }
        a { color: #00f; text-decoration: none; }
        table { width: 100%; border-spacing: 0; }
        th, td { padding: 4px 12px; text-align: left; }
        th { border-bottom: 1px solid #ccc; }
    </style>
</head>
<body>
    <h1>Index of /</h1>
    <table>
        <thead>
            <tr>
                <th>Name</th><th>Last Modified</th><th>Size</th>
            </tr>
        </thead>
        <tbody>
            ${parentFolderLink}
            ${folders}
            ${files}
        </tbody>
    </table>
</body>
</html>`, { headers: { "Content-Type": "text/html" } });
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
