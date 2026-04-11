# Cloud-Based Desktop Application Deployment Guide

## Overview
This guide explains how to deploy your Medical ERP as a cloud-based desktop application where:
- **Backend (Node.js + MongoDB)** runs on Ubuntu server
- **Desktop App (Electron)** connects to the cloud server

---

## Part 1: Deploy Backend to Ubuntu Server

### Step 1: Prepare Ubuntu Server

1. **SSH into your Ubuntu server:**
   ```bash
   ssh user@your-server-ip
   ```

2. **Install Node.js (v18 or higher):**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   node --version  # Verify installation
   ```

3. **Install MongoDB:**
   ```bash
   wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -
   echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
   sudo apt-get update
   sudo apt-get install -y mongodb-org
   sudo systemctl start mongod
   sudo systemctl enable mongod
   ```

4. **Install PM2 (Process Manager):**
   ```bash
   sudo npm install -g pm2
   ```

### Step 2: Upload Project to Server

1. **On your Windows machine, create a deployment package:**
   - Copy your entire project folder
   - Exclude `node_modules`, `dist`, `.git`
   - Compress it (zip/tar.gz)

2. **Upload to Ubuntu server:**
   ```bash
   # Using SCP from Windows (PowerShell or CMD)
   scp -r "D:\Medical ERP App" user@your-server-ip:/home/user/medical-erp
   
   # Or use FileZilla/WinSCP for GUI transfer
   ```

3. **On Ubuntu server, extract and install:**
   ```bash
   cd /home/user/medical-erp
   npm install --production
   ```

### Step 3: Configure Environment

1. **Create `.env` file:**
   ```bash
   nano .env
   ```
   
   Add:
   ```
   MONGO_URI=mongodb://localhost:27017/medical_erp
   PORT=3000
   NODE_ENV=production
   ```

2. **Update `api-config.json` for server (optional, for reference):**
   ```json
   {
     "apiBase": "http://your-server-ip:3000",
     "useCloudServer": true
   }
   ```

### Step 4: Start Backend with PM2

```bash
pm2 start server.js --name medical-erp
pm2 save
pm2 startup  # Follow instructions to enable auto-start on boot
```

### Step 5: Configure Firewall

```bash
sudo ufw allow 3000/tcp
sudo ufw enable
sudo ufw status
```

### Step 6: Set Up Reverse Proxy (Optional but Recommended)

Install Nginx:
```bash
sudo apt install nginx
```

Create config:
```bash
sudo nano /etc/nginx/sites-available/medical-erp
```

Add:
```nginx
server {
    listen 80;
    server_name your-domain.com;  # or your-server-ip

    location / {
        proxy_pass http://84.247.169.194;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable:
```bash
sudo ln -s /etc/nginx/sites-available/medical-erp /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## Part 2: Configure Desktop App for Cloud

### Step 1: Update API Configuration

1. **Edit `api-config.json` in your project:**
   ```json
   {
     "apiBase": "http://your-server-ip:3000",
     "useCloudServer": true
   }
   ```
   
   Or if using domain:
   ```json
   {
     "apiBase": "http://your-domain.com",
     "useCloudServer": true
   }
   ```

### Step 2: Rebuild Desktop App

```bash
npm run build:win
```

The new installer will connect to your cloud server instead of localhost.

### Step 3: Distribute Desktop App

- The `.exe` installer in `dist/` folder can be distributed to users
- Users install it like any Windows application
- The app will automatically connect to your cloud server

---

## Part 3: Testing

### Test Backend on Server:
```bash
curl http://84.247.169.194/api/dashboard
```

### Test from Desktop App:
1. Install the rebuilt `.exe`
2. Open the app
3. It should connect to cloud server automatically
4. Check browser DevTools (F12) → Network tab to see API calls

---

## Part 4: Monitoring & Maintenance

### Check PM2 Status:
```bash
pm2 status
pm2 logs medical-erp
pm2 restart medical-erp
```

### MongoDB Commands:
```bash
mongo
use medical_erp
show collections
db.salesmen.find()
```

### Update Backend:
```bash
cd /home/user/medical-erp
git pull  # if using git
# or upload new files
npm install
pm2 restart medical-erp
```

---

## Troubleshooting

### Desktop app can't connect:
- Check firewall allows port 3000
- Verify server IP/domain is correct in `api-config.json`
- Test: `curl http://your-server-ip:3000/api/dashboard` from Windows

### MongoDB connection issues:
- Check MongoDB is running: `sudo systemctl status mongod`
- Verify MONGO_URI in `.env`

### PM2 issues:
- Check logs: `pm2 logs medical-erp`
- Restart: `pm2 restart medical-erp`

---

## Security Recommendations

1. **Use HTTPS** (Let's Encrypt SSL certificate)
2. **Set up authentication** for API endpoints
3. **Use environment variables** for sensitive data
4. **Regular backups** of MongoDB database
5. **Firewall rules** to restrict access

---

## Summary

✅ Backend runs on Ubuntu server (Node.js + MongoDB)  
✅ Desktop app connects to cloud server  
✅ Users install `.exe` and use the app  
✅ All data stored in cloud MongoDB  
✅ Centralized management and updates

