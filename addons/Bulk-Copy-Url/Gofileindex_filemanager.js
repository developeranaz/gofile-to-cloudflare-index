addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  
  // Add CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }

  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    if (url.pathname === '/api/folders' && request.method === 'GET') {
      return await getFolders(request, corsHeaders)
    } else if (url.pathname === '/api/fetch-files' && request.method === 'POST') {
      return await fetchFiles(request, corsHeaders)
    } else {
      // Serve the HTML interface for all other requests
      return new Response(getHTMLInterface(), {
        headers: { 'Content-Type': 'text/html' }
      })
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}

async function getFolders(request, corsHeaders) {
  const url = new URL(request.url)
  const baseUrl = url.searchParams.get('url') || 'YOUR_FIRST_GOINDEX_URL'
  
  // Ensure the URL ends with a slash
  const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/'
  
  try {
    const response = await fetch(cleanBaseUrl)
    const html = await response.text()
    
    // Extract folder links and names
    const folderRegex = /<a href="\/\?folder=([^"]+)">📁\s*([^<]+)<\/a>/g
    const folders = []
    let match
    
    while ((match = folderRegex.exec(html)) !== null) {
      folders.push({
        id: match[1],
        name: match[2].trim(),
        url: `${cleanBaseUrl}?folder=${match[1]}`
      })
    }
    
    return new Response(JSON.stringify({ folders }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch folders' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}

async function fetchFiles(request, corsHeaders) {
  const requestBody = await request.json()
  const { folderIds, baseUrl } = requestBody
  
  if (!folderIds || !Array.isArray(folderIds)) {
    return new Response(JSON.stringify({ error: 'Invalid folder IDs provided' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const cleanBaseUrl = (baseUrl || 'YOUR_FIRST_GOINDEX_URL').endsWith('/') ? 
    (baseUrl || 'YOUR_FIRST_GOINDEX_URL') : 
    (baseUrl || 'YOUR_FIRST_GOINDEX_URL') + '/'
  const results = []
  
  for (const folderId of folderIds) {
    try {
      const folderUrl = `${cleanBaseUrl}?folder=${folderId}`
      const response = await fetch(folderUrl)
      const html = await response.text()
      
      // Extract file information from the HTML
      const fileRegex = /<tr[^>]*data-time="[^"]*"[^>]*>[\s\S]*?<td>🎥\s*<a href="\/download\/([^"?]+)\?folder=([^"]+)">([^<]+)<\/a><\/td>[\s\S]*?<td>([^<]+)<\/td>[\s\S]*?<td>([^<]+)<\/td>[\s\S]*?<\/tr>/g
      const match = fileRegex.exec(html)
      
      if (match) {
        const fileName = match[3].trim()
        const fileSize = match[4].trim()
        const downloadUrl = `${cleanBaseUrl}download/${match[1]}?folder=${match[2]}`
        
        results.push({
          folderId: folderId,
          fileName: fileName,
          fileSize: fileSize,
          downloadUrl: downloadUrl
        })
      } else {
        // Fallback: try another pattern for file extraction
        const altFileRegex = /<a href="\/download\/([^"?]+)\?folder=([^"]+)">([^<]+)<\/a>[\s\S]*?<td>([^<]+)<\/td>/g
        const altMatch = altFileRegex.exec(html)
        
        if (altMatch) {
          const fileName = altMatch[3].trim()
          const fileSize = altMatch[4].trim()
          const downloadUrl = `${cleanBaseUrl}download/${altMatch[1]}?folder=${altMatch[2]}`
          
          results.push({
            folderId: folderId,
            fileName: fileName,
            fileSize: fileSize,
            downloadUrl: downloadUrl
          })
        } else {
          results.push({
            folderId: folderId,
            error: 'No file found in this folder'
          })
        }
      }
    } catch (error) {
      results.push({
        folderId: folderId,
        error: `Failed to fetch folder: ${error.message}`
      })
    }
    
    // Add small delay between requests to avoid overwhelming the server
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  
  return new Response(JSON.stringify({ results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

function getHTMLInterface() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GoFile Folder Search & Fetch</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        
        .container {
            max-width: 1000px;
            margin: 0 auto;
            background: rgba(255, 255, 255, 0.95);
            border-radius: 15px;
            padding: 30px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            backdrop-filter: blur(10px);
        }
        
        h1 {
            text-align: center;
            color: #333;
            margin-bottom: 30px;
            font-size: 2.5em;
            background: linear-gradient(135deg, #667eea, #764ba2);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        
        .url-selector {
            margin-bottom: 20px;
            padding: 20px;
            background: rgba(255, 255, 255, 0.9);
            border-radius: 12px;
            border: 1px solid rgba(102, 126, 234, 0.3);
        }
        
        .url-selector label {
            font-weight: bold;
            color: #333;
            margin-bottom: 10px;
            display: block;
            font-size: 16px;
        }
        
        #urlSelect {
            width: 100%;
            padding: 12px 15px;
            border: 2px solid #667eea;
            border-radius: 8px;
            font-size: 16px;
            background: rgba(255, 255, 255, 0.95);
            color: #333;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        
        #urlSelect:focus {
            outline: none;
            border-color: #764ba2;
            box-shadow: 0 0 10px rgba(102, 126, 234, 0.3);
        }
        
        #urlSelect option {
            padding: 10px;
            background: white;
            color: #333;
        }
        
        .search-section {
            margin-bottom: 30px;
            padding: 25px;
            background: rgba(255, 255, 255, 0.8);
            border-radius: 12px;
            border: 1px solid rgba(102, 126, 234, 0.2);
        }
        
        .search-controls {
            display: flex;
            gap: 15px;
            margin-bottom: 20px;
            flex-wrap: wrap;
        }
        
        #searchInput {
            flex: 1;
            padding: 15px;
            border: 2px solid #667eea;
            border-radius: 8px;
            font-size: 16px;
            background: rgba(255, 255, 255, 0.9);
            min-width: 250px;
        }
        
        #searchInput:focus {
            outline: none;
            border-color: #764ba2;
            box-shadow: 0 0 10px rgba(102, 126, 234, 0.3);
        }
        
        .btn {
            padding: 15px 25px;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.3s ease;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        .btn-primary {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
        }
        
        .btn-success {
            background: linear-gradient(135deg, #11998e, #38ef7d);
            color: white;
        }
        
        .btn-secondary {
            background: linear-gradient(135deg, #ffecd2, #fcb69f);
            color: #333;
        }
        
        .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(0,0,0,0.15);
        }
        
        .btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
        }
        
        .status {
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
            font-weight: bold;
            display: none;
        }
        
        .status.loading {
            background: #e3f2fd;
            color: #1976d2;
            border-left: 4px solid #1976d2;
            display: block;
        }
        
        .status.success {
            background: #e8f5e8;
            color: #2e7d32;
            border-left: 4px solid #4caf50;
            display: block;
        }
        
        .status.error {
            background: #ffebee;
            color: #c62828;
            border-left: 4px solid #f44336;
            display: block;
        }
        
        .results-section {
            margin-top: 30px;
        }
        
        .folder-list {
            background: rgba(255, 255, 255, 0.9);
            border-radius: 12px;
            padding: 20px;
            max-height: 300px;
            overflow-y: auto;
            border: 1px solid rgba(102, 126, 234, 0.2);
        }
        
        .folder-item {
            padding: 12px;
            border-bottom: 1px solid #eee;
            border-radius: 6px;
            margin-bottom: 8px;
            background: rgba(102, 126, 234, 0.05);
            transition: background 0.3s ease;
        }
        
        .folder-item:hover {
            background: rgba(102, 126, 234, 0.1);
        }
        
        .folder-item:last-child {
            border-bottom: none;
        }
        
        .folder-name {
            font-weight: bold;
            color: #333;
            word-break: break-word;
        }
        
        .file-results {
            background: rgba(255, 255, 255, 0.9);
            border-radius: 12px;
            padding: 20px;
            margin-top: 20px;
            border: 1px solid rgba(102, 126, 234, 0.2);
        }
        
        .file-item {
            padding: 15px;
            border: 1px solid #ddd;
            border-radius: 8px;
            margin-bottom: 15px;
            background: rgba(102, 126, 234, 0.05);
        }
        
        .file-name {
            font-weight: bold;
            color: #333;
            font-size: 16px;
            margin-bottom: 5px;
        }
        
        .file-size {
            color: #666;
            font-size: 14px;
            margin-bottom: 5px;
        }
        
        .file-url {
            font-size: 12px;
            color: #888;
            word-break: break-all;
        }
        
        .copy-format {
            background: #f8f9fa;
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 15px;
            margin: 20px 0;
            font-family: 'Courier New', monospace;
            white-space: pre-wrap;
            max-height: 300px;
            overflow-y: auto;
            font-size: 14px;
        }
        
        .loading-spinner {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 3px solid #f3f3f3;
            border-top: 3px solid #667eea;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-right: 10px;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        .progress {
            background: #e0e0e0;
            border-radius: 10px;
            overflow: hidden;
            margin: 10px 0;
            height: 8px;
        }
        
        .progress-bar {
            background: linear-gradient(135deg, #667eea, #764ba2);
            height: 100%;
            transition: width 0.3s ease;
            border-radius: 10px;
        }
        
        @media (max-width: 768px) {
            .container {
                padding: 20px;
            }
            
            h1 {
                font-size: 2em;
            }
            
            .search-controls {
                flex-direction: column;
            }
            
            #searchInput {
                min-width: auto;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔍 GoFile Folder Search & Fetch</h1>
        
        <div class="url-selector">
            <label for="urlSelect">🌐 Select GoFile URL:</label>
            <select id="urlSelect">
                <option value="YOUR_FIRST_GOINDEX_URL">YOUR_FIRST_GOINDEX_NAME</option>
                <option value="YOUR_SECOND_GOINDEX_URL">YOUR_SECOND_GOINDEX_NAME</option>
            </select>
        </div>
        
        <div class="search-section">
            <div class="search-controls">
                <input type="text" id="searchInput" placeholder="Search folder names..." />
                <button id="loadFoldersBtn" class="btn btn-primary">Load Folders</button>
                <button id="fetchFilesBtn" class="btn btn-success" disabled>Fetch Files</button>
                <button id="bulkCopyBtn" class="btn btn-secondary" disabled>Bulk Copy</button>
            </div>
            
            <div id="status" class="status"></div>
            
            <div id="progress" class="progress" style="display: none;">
                <div id="progressBar" class="progress-bar" style="width: 0%;"></div>
            </div>
        </div>
        
        <div class="results-section">
            <div id="folderResults" style="display: none;">
                <h3>📁 Found Folders:</h3>
                <div id="folderList" class="folder-list"></div>
            </div>
            
            <div id="fileResults" style="display: none;">
                <h3>📄 Fetched Files:</h3>
                <div id="fileList" class="file-results"></div>
                <div id="copyFormat" class="copy-format"></div>
            </div>
        </div>
    </div>

    <script>
        // Use current origin as worker URL since everything is in one worker
        const WORKER_URL = window.location.origin;
        
        let allFolders = [];
        let filteredFolders = [];
        let fetchedFiles = [];
        
        const elements = {
            searchInput: document.getElementById('searchInput'),
            urlSelect: document.getElementById('urlSelect'),
            loadFoldersBtn: document.getElementById('loadFoldersBtn'),
            fetchFilesBtn: document.getElementById('fetchFilesBtn'),
            bulkCopyBtn: document.getElementById('bulkCopyBtn'),
            status: document.getElementById('status'),
            progress: document.getElementById('progress'),
            progressBar: document.getElementById('progressBar'),
            folderResults: document.getElementById('folderResults'),
            folderList: document.getElementById('folderList'),
            fileResults: document.getElementById('fileResults'),
            fileList: document.getElementById('fileList'),
            copyFormat: document.getElementById('copyFormat')
        };
        
        // Event listeners
        elements.searchInput.addEventListener('input', handleSearch);
        elements.urlSelect.addEventListener('change', handleUrlChange);
        elements.loadFoldersBtn.addEventListener('click', loadFolders);
        elements.fetchFilesBtn.addEventListener('click', fetchFiles);
        elements.bulkCopyBtn.addEventListener('click', copyToClipboard);
        
        function handleUrlChange() {
            // Reset everything when URL changes
            allFolders = [];
            filteredFolders = [];
            fetchedFiles = [];
            elements.searchInput.value = '';
            elements.folderResults.style.display = 'none';
            elements.fileResults.style.display = 'none';
            elements.fetchFilesBtn.disabled = true;
            elements.bulkCopyBtn.disabled = true;
            hideStatus();
            
            // Auto-load folders for the new URL
            loadFolders();
        }
        
        function showStatus(message, type = 'loading') {
            elements.status.className = \`status \${type}\`;
            elements.status.innerHTML = type === 'loading' ? 
                \`<span class="loading-spinner"></span>\${message}\` : message;
        }
        
        function hideStatus() {
            elements.status.style.display = 'none';
        }
        
        function updateProgress(current, total) {
            if (total > 0) {
                const percentage = (current / total) * 100;
                elements.progress.style.display = 'block';
                elements.progressBar.style.width = \`\${percentage}%\`;
            } else {
                elements.progress.style.display = 'none';
            }
        }
        
        async function loadFolders() {
            try {
                elements.loadFoldersBtn.disabled = true;
                showStatus('Loading folders...', 'loading');
                
                const selectedUrl = elements.urlSelect.value;
                const response = await fetch(\`\${WORKER_URL}/api/folders?url=\${encodeURIComponent(selectedUrl)}\`);
                const data = await response.json();
                
                if (data.folders) {
                    allFolders = data.folders;
                    filteredFolders = [...allFolders];
                    displayFolders();
                    showStatus(\`Loaded \${allFolders.length} folders successfully!\`, 'success');
                    setTimeout(hideStatus, 3000);
                } else {
                    throw new Error('No folders found');
                }
            } catch (error) {
                showStatus(\`Error loading folders: \${error.message}\`, 'error');
            } finally {
                elements.loadFoldersBtn.disabled = false;
            }
        }
        
        function handleSearch() {
            const searchTerm = elements.searchInput.value.toLowerCase();
            
            if (searchTerm === '') {
                filteredFolders = [...allFolders];
            } else {
                filteredFolders = allFolders.filter(folder =>
                    folder.name.toLowerCase().includes(searchTerm)
                );
            }
            
            displayFolders();
            elements.fetchFilesBtn.disabled = filteredFolders.length === 0;
            elements.bulkCopyBtn.disabled = true;
            elements.fileResults.style.display = 'none';
        }
        
        function displayFolders() {
            if (filteredFolders.length === 0) {
                elements.folderResults.style.display = 'none';
                return;
            }
            
            elements.folderList.innerHTML = filteredFolders.map(folder =>
                \`<div class="folder-item">
                    <div class="folder-name">📁 \${folder.name}</div>
                </div>\`
            ).join('');
            
            elements.folderResults.style.display = 'block';
            elements.fetchFilesBtn.disabled = false;
        }
        
        async function fetchFiles() {
            if (filteredFolders.length === 0) return;
            
            try {
                elements.fetchFilesBtn.disabled = true;
                showStatus(\`Fetching files from \${filteredFolders.length} folders...\`, 'loading');
                
                const folderIds = filteredFolders.map(folder => folder.id);
                const selectedUrl = elements.urlSelect.value;
                updateProgress(0, folderIds.length);
                
                const response = await fetch(\`\${WORKER_URL}/api/fetch-files\`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ folderIds, baseUrl: selectedUrl })
                });
                
                const data = await response.json();
                
                if (data.results) {
                    fetchedFiles = data.results.filter(result => !result.error);
                    displayFiles();
                    updateProgress(folderIds.length, folderIds.length);
                    
                    showStatus(\`Successfully fetched \${fetchedFiles.length} files!\`, 'success');
                    setTimeout(hideStatus, 3000);
                    
                    elements.bulkCopyBtn.disabled = fetchedFiles.length === 0;
                } else {
                    throw new Error('Failed to fetch files');
                }
            } catch (error) {
                showStatus(\`Error fetching files: \${error.message}\`, 'error');
            } finally {
                elements.fetchFilesBtn.disabled = false;
                setTimeout(() => {
                    elements.progress.style.display = 'none';
                }, 2000);
            }
        }
        
        function displayFiles() {
            if (fetchedFiles.length === 0) {
                elements.fileResults.style.display = 'none';
                return;
            }
            
            elements.fileList.innerHTML = fetchedFiles.map(file =>
                \`<div class="file-item">
                    <div class="file-name">🎥 \${file.fileName}</div>
                    <div class="file-size">📊 Size: \${file.fileSize}</div>
                    <div class="file-url">🔗 \${file.downloadUrl}</div>
                </div>\`
            ).join('');
            
            const copyText = fetchedFiles.map(file =>
                \`\${file.fileName} | \${file.fileSize} | \${file.downloadUrl}\`
            ).join('\\n\\n');
            
            elements.copyFormat.textContent = copyText;
            elements.fileResults.style.display = 'block';
        }
        
        async function copyToClipboard() {
            try {
                const copyText = fetchedFiles.map(file =>
                    \`\${file.fileName} | \${file.fileSize} | \${file.downloadUrl}\`
                ).join('\\n\\n');
                
                await navigator.clipboard.writeText(copyText);
                showStatus('✅ Copied to clipboard successfully!', 'success');
                setTimeout(hideStatus, 3000);
            } catch (error) {
                showStatus('❌ Failed to copy to clipboard', 'error');
            }
        }
        
        // Auto-load folders on page load
        window.addEventListener('load', loadFolders);
    </script>
</body>
</html>`
}
