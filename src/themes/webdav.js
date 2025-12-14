// This is only for simple webdav
// large uploads are impossible (>1mb,  may be small files may upload working on it)
// Considr this a s a beta one , thhis will fails
const GOFILE_API_BASE = "https://api.gofile.io/contents/";
const AUTH_TOKEN = "Bearer THEGOFILETOKEN"; // Replace with your API Key
const ROOT_FOLDER_ID = "THEROOTFOLDERID"; // Replace your custom or root folder ID here

// Webdav authentication
// this need to be changed with  your own usrname and passwd
const WEBDAV_AUTH = {
  username: "theusername",
  password: "thepassword"
};

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const method = request.method;
    
  
    const authHeader = request.headers.get('Authorization');
    if (!checkAuth(authHeader)) {
      return new Response('Unauthorized', {
        status: 401,
        headers: {
          'WWW-Authenticate': 'Basic realm="GoFile WebDAV"',
        }
      });
    }
    
    try {
      const path = decodeURIComponent(url.pathname);
      
      switch (method) {
        case 'OPTIONS':
          return handleOptions();
        
        case 'PROPFIND':
          return await handlePropfind(request, path);
        
        case 'GET':
        case 'HEAD':
          return await handleGet(path, method === 'HEAD', request);
        
        case 'PUT':
          return await handlePut(request, path);
        
        case 'DELETE':
          return await handleDelete(path);
        
        case 'MKCOL':
          return await handleMkcol(path);
        
        case 'COPY':
          return await handleCopy(request, path);
        
        case 'MOVE':
          return await handleMove(request, path);
        
        default:
          return new Response('Method Not Allowed', { status: 405 });
      }
    } catch (error) {
      console.error('Error:', error);
      return new Response('Internal Server Error: ' + error.message, { status: 500 });
    }
  }
};

function checkAuth(authHeader) {
  if (!authHeader || !authHeader.startsWith('Basic ')) return false;
  
  try {
    const auth = authHeader.slice(6);
    const decoded = atob(auth);
    const [username, password] = decoded.split(':');
    return username === WEBDAV_AUTH.username && password === WEBDAV_AUTH.password;
  } catch {
    return false;
  }
}

async function fetchGoFileContents(folderId) {
  try {
    const response = await fetch(`${GOFILE_API_BASE}${folderId}?wt=4fd6sg89d7s6&contentFilter=&page=1&pageSize=1000&sortField=createTime&sortDirection=-1`, {
      headers: {
        "authorization": AUTH_TOKEN,
        "x-website-token": "4fd6sg89d7s6"
      }
    });
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
    
    const data = await response.json();
    if (data.status !== "ok") {
      throw new Error(`API error: ${data.message || "Unknown error"}`);
    }
    
    return data;
  } catch (error) {
    console.error("Fetch error:", error);
    return { status: "error", message: error.message };
  }
}

function pathToFolderId(path) {

  if (path === '/' || path === '') {
    return ROOT_FOLDER_ID;
  }
  

  const parts = path.split('/').filter(Boolean);
  if (parts.length === 0) return ROOT_FOLDER_ID;
  
  // Extract folder ID from last part (format: name-id)
  const lastPart = parts[parts.length - 1];
  const match = lastPart.match(/-([a-f0-9-]+)$/);
  
  if (match) {
    return match[1];
  }
  
  return ROOT_FOLDER_ID;
}

async function findFileByPath(path) {
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 0) return null;
  
  const fileName = decodeURIComponent(parts[parts.length - 1]);
  const folderPath = '/' + parts.slice(0, -1).join('/');
  const folderId = pathToFolderId(folderPath);
  
  const data = await fetchGoFileContents(folderId);
  if (data.status !== "ok") return null;
  
  // Find file by exact name match
  const file = Object.values(data.data.children).find(f => 
    f.type !== "folder" && f.name === fileName
  );
  
  return file;
}

function handleOptions() {
  return new Response(null, {
    status: 200,
    headers: {
      'DAV': '1, 2',
      'Allow': 'OPTIONS, GET, HEAD, PROPFIND',
      'MS-Author-Via': 'DAV',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'OPTIONS, GET, HEAD, PROPFIND',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, Depth, Destination'
    }
  });
}

async function handlePropfind(request, path) {
  const depth = request.headers.get('Depth') || '1';
  const folderId = pathToFolderId(path);
  
  try {
    const data = await fetchGoFileContents(folderId);
    
    if (data.status !== "ok") {
      return new Response('Not Found', { status: 404 });
    }
    
    const xml = generatePropfindXML(data, path, depth);
    
    return new Response(xml, {
      status: 207,
      headers: { 'Content-Type': 'application/xml; charset=utf-8' }
    });
  } catch (error) {
    return new Response('Error: ' + error.message, { status: 500 });
  }
}

function generatePropfindXML(data, requestPath, depth) {
  let xml = '<?xml version="1.0" encoding="utf-8"?>\n';
  xml += '<D:multistatus xmlns:D="DAV:">\n';

  const folder = data.data;
  xml += generateFolderXML(requestPath, folder);
  

  if (depth !== '0' && folder.children) {
    for (const item of Object.values(folder.children)) {
      let itemPath;
      
      if (item.type === "folder") {
 
        itemPath = requestPath === '/' 
          ? `/${item.name}-${item.id}`
          : `${requestPath}/${item.name}-${item.id}`;
        xml += generateFolderResourceXML(itemPath, item);
      } else {
        // Files just use their name
        itemPath = requestPath === '/' 
          ? `/${item.name}`
          : `${requestPath}/${item.name}`;
        xml += generateFileResourceXML(itemPath, item);
      }
    }
  }
  
  xml += '</D:multistatus>';
  return xml;
}

function generateFolderXML(path, folder) {
  const href = escapeXml(path || '/');
  const displayName = escapeXml(folder.name || 'root');
  const modified = new Date((folder.modTime || Date.now() / 1000) * 1000).toUTCString();
  const created = new Date((folder.createTime || folder.modTime || Date.now() / 1000) * 1000).toUTCString();
  
  let xml = `  <D:response>\n`;
  xml += `    <D:href>${href}</D:href>\n`;
  xml += `    <D:propstat>\n`;
  xml += `      <D:prop>\n`;
  xml += `        <D:displayname>${displayName}</D:displayname>\n`;
  xml += `        <D:getlastmodified>${modified}</D:getlastmodified>\n`;
  xml += `        <D:creationdate>${created}</D:creationdate>\n`;
  xml += `        <D:resourcetype><D:collection/></D:resourcetype>\n`;
  xml += `      </D:prop>\n`;
  xml += `      <D:status>HTTP/1.1 200 OK</D:status>\n`;
  xml += `    </D:propstat>\n`;
  xml += `  </D:response>\n`;
  
  return xml;
}

function generateFolderResourceXML(path, folder) {
  const href = escapeXml(path);
  const displayName = escapeXml(folder.name);
  const modified = new Date((folder.modTime || Date.now() / 1000) * 1000).toUTCString();
  const created = new Date((folder.createTime || folder.modTime || Date.now() / 1000) * 1000).toUTCString();
  
  let xml = `  <D:response>\n`;
  xml += `    <D:href>${href}</D:href>\n`;
  xml += `    <D:propstat>\n`;
  xml += `      <D:prop>\n`;
  xml += `        <D:displayname>${displayName}</D:displayname>\n`;
  xml += `        <D:getlastmodified>${modified}</D:getlastmodified>\n`;
  xml += `        <D:creationdate>${created}</D:creationdate>\n`;
  xml += `        <D:resourcetype><D:collection/></D:resourcetype>\n`;
  xml += `      </D:prop>\n`;
  xml += `      <D:status>HTTP/1.1 200 OK</D:status>\n`;
  xml += `    </D:propstat>\n`;
  xml += `  </D:response>\n`;
  
  return xml;
}

function generateFileResourceXML(path, file) {
  const href = escapeXml(path);
  const displayName = escapeXml(file.name);
  const modified = new Date((file.modTime || Date.now() / 1000) * 1000).toUTCString();
  const created = new Date((file.createTime || file.modTime || Date.now() / 1000) * 1000).toUTCString();
  
  let xml = `  <D:response>\n`;
  xml += `    <D:href>${href}</D:href>\n`;
  xml += `    <D:propstat>\n`;
  xml += `      <D:prop>\n`;
  xml += `        <D:displayname>${displayName}</D:displayname>\n`;
  xml += `        <D:getlastmodified>${modified}</D:getlastmodified>\n`;
  xml += `        <D:creationdate>${created}</D:creationdate>\n`;
  xml += `        <D:resourcetype/>\n`;
  xml += `        <D:getcontentlength>${file.size || 0}</D:getcontentlength>\n`;
  xml += `        <D:getcontenttype>${getContentType(file.name)}</D:getcontenttype>\n`;
  xml += `        <D:getetag>"${file.md5 || file.id}"</D:getetag>\n`;
  xml += `      </D:prop>\n`;
  xml += `      <D:status>HTTP/1.1 200 OK</D:status>\n`;
  xml += `    </D:propstat>\n`;
  xml += `  </D:response>\n`;
  
  return xml;
}

async function handleGet(path, headOnly = false, request) {
  if (path === '/' || path === '') {
    return new Response('GoFile WebDAV Root Directory', { status: 200 });
  }
  
  try {
    const file = await findFileByPath(path);
    
    if (!file) {
      return new Response('Not Found', { status: 404 });
    }
    
    // GoFile download requires specific headers
    let headers = {
      "authority": new URL(file.link).hostname,
      "accept": "*/*",
      "referer": "https://gofile.io/",
      "cookie": `accountToken=${AUTH_TOKEN.split(" ")[1]}`,
      "user-agent": request.headers.get("user-agent") || "Mozilla/5.0"
    };
    
    // Handle range requests for partial downloads
    let rangeHeader = request.headers.get("Range");
    if (rangeHeader) {
      headers["Range"] = rangeHeader;
    }
    
    if (headOnly) {
      const headResponse = await fetch(file.link, { 
        method: 'HEAD',
        headers 
      });
      
      return new Response(null, {
        status: 200,
        headers: {
          'Content-Type': headResponse.headers.get('Content-Type') || getContentType(file.name),
          'Content-Length': file.size?.toString() || '0',
          'Last-Modified': new Date((file.modTime || Date.now() / 1000) * 1000).toUTCString(),
          'ETag': `"${file.md5 || file.id}"`,
          'Accept-Ranges': 'bytes'
        }
      });
    }
    
    // Stream the file from GoFile
    const fileResponse = await fetch(file.link, { headers });
    
    let responseHeaders = new Headers(fileResponse.headers);
    responseHeaders.set('Content-Disposition', `attachment; filename="${file.name}"`);
    responseHeaders.set('Access-Control-Expose-Headers', 'Content-Range, Content-Length');
    responseHeaders.set('Accept-Ranges', 'bytes');
    
    return new Response(fileResponse.body, {
      status: fileResponse.status,
      headers: responseHeaders
    });
  } catch (error) {
    return new Response('Error: ' + error.message, { status: 500 });
  }
}

async function handlePut(request, path) {
  return new Response('Upload not supported - GoFile.io API limitation', { 
    status: 501 
  });
}

async function handleDelete(path) {
  return new Response('Delete not supported - GoFile.io API limitation', { 
    status: 501 
  });
}

async function handleMkcol(path) {
  return new Response('Create folder not supported - GoFile.io API limitation', { 
    status: 501 
  });
}

async function handleCopy(request, path) {
  return new Response('Copy not supported - GoFile.io API limitation', { 
    status: 501 
  });
}

async function handleMove(request, path) {
  return new Response('Move not supported - GoFile.io API limitation', { 
    status: 501 
  });
}

function getContentType(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const types = {
    'txt': 'text/plain',
    'html': 'text/html',
    'css': 'text/css',
    'js': 'application/javascript',
    'json': 'application/json',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'pdf': 'application/pdf',
    'zip': 'application/zip',
    'rar': 'application/x-rar-compressed',
    '7z': 'application/x-7z-compressed',
    'mp3': 'audio/mpeg',
    'mp4': 'video/mp4',
    'mkv': 'video/x-matroska',
    'avi': 'video/x-msvideo',
    'mov': 'video/quicktime',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  };
  return types[ext] || 'application/octet-stream';
}

function escapeXml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;'
  };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}
