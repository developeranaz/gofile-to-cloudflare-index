# gofile-to-cloudflare-index
A Cloudflare Worker-based indexer for [gofile.io](https://gofile.io) that improves download speed, enhances stability, and offers unlimited access to private free account files. Automatically fetches and serves gofile links through fast, reliable, permanent links with extreme pause-resume support and multithreaded downloads.

**Unofficial GoFile.io File Indexer** built for Cloudflare Workers.  
⚠️ **Disclaimer**: This is **not** an official GoFile.io product. Use at your own risk.

---

## 🚀 Features
- Index & browse your GoFile.io files/folders via a web interface
- Customizable themes (Lite, Dark, Simple)
- Direct integration with GoFile.io API using your account token
- Free unlimited storage (via GoFile.io)

---

## ⚠️ Important Notes
- **Not affiliated with GoFile.io** - This is a community-built solution
- **Personal use recommended** - Avoid storing sensitive/copyrighted content
- **No uptime guarantees** - Depends on Cloudflare Workers and GoFile.io availability
- **Token security** - Your GoFile.io token is only stored locally in your Worker

---

## 🛠️ Deployment Steps

### Step 1: Generate Worker Code
1. Visit [Gofile Code Generator](https://developeranaz.github.io/webapps/gofile.io/)
2. Enter your **registered GoFile.io email**
3. Click `Send login link` and check your email for authentication token/URL
4. Paste received token in `Authentication Token` field
5. Select preferred theme
6. Click `Generate Code` and copy the generated code

### Step 2: Deploy to Cloudflare Workers
1. Login to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **Workers & Pages** > **Create Application**
3. Choose `Start with Hello World!` > **Get started**
4. Name your worker (optional) > Click **Deploy**
5. After deployment, click **Edit Code** (top-right)
6. Delete all default code in `worker.js`
7. Paste your generated code > Click **Deploy**
8. Wait a few minutes, then click **Visit** to access your index

---

## ❓ Why GoFile.io?
- **Free unlimited storage** - No size restrictions
- **No registration required** (optional for account features)
- **Temporary file hosting** - Great for personal/short-term projects
- **API access** - Easy integration with scripts

---

## 🔒 Responsible Usage
- Intended for **personal/non-commercial** use only
- Do not host illegal/copyrighted content
- Maintain your own backups - Data persistence not guaranteed
- Monitor your Cloudflare Worker usage

---

## 📜 License
MIT License - See [LICENSE](LICENSE) for details

**Use responsibly** - Contributors not liable for misuse
