# Complete Deployment Guide - Medical ERP Cloud-Based Desktop Application

## 🏗️ Architecture Overview

### **Important: All Data Stored on Linux Server**
- **100GB Linux Server** = Central data storage for entire ERP system
- **MongoDB Database** = All ERP data (sales, invoices, customers, employees, etc.) stored on server
- **Desktop App (.exe)** = Client application that connects to server (NO local data storage)
- **User's Windows PC** = Only runs the desktop app interface, all data operations go to server

### **Login Flow Requirements**
1. **App Always Starts at Login Page** - No auto-login, users must authenticate every time
2. **Admin Login** - Full access to all modules after successful login
3. **Employee Login** - Redirected to their assigned modules only (based on Roles & Permissions)
4. **Session Management** - Session cleared on app close, must login again on next start

### **Data Flow**
```
Desktop App (.exe) → Internet → Linux Server (100GB) → MongoDB Database
                    (API Calls)    (Node.js Backend)    (All Data Stored)
```

---

## 📋 Table of Contents
1. [What We've Completed](#what-weve-completed)
2. [What's Left to Do](#whats-left-to-do)
3. [Step-by-Step Deployment Process](#step-by-step-deployment-process)
4. [Post-Deployment Checklist](#post-deployment-checklist)

---

## ✅ What We've Completed

### 1. **MongoDB Integration**
- ✅ Created MongoDB connection (`db.js`)
- ✅ Created Mongoose models (`models/Salesman.js`)
- ✅ Converted Salesman Department module to use MongoDB
- ✅ Set up automatic JSON-to-MongoDB sync for all modules (`mongoSync.js`)
- ✅ All future data will be stored in MongoDB

### 2. **Desktop Application Build Setup**
- ✅ Added `electron-builder` to package.json
- ✅ Configured Windows .exe build settings
- ✅ Configured Linux AppImage build settings
- ✅ Updated `main.js` to handle packaged app paths
- ✅ Set up build scripts (`npm run build:win`, `npm run build:linux`)

### 3. **Cloud-Based Architecture**
- ✅ Created `api-config.json` for API endpoint configuration
- ✅ Updated `main.js` to load and inject API config
- ✅ Updated `renderer.js` to use cloud API URL
- ✅ Updated `login.html` to use cloud API URL
- ✅ Added cloud server mode (doesn't start local server when using cloud)
- ✅ **Fixed login flow** - App always shows login page on start (no auto-login)
- ✅ **Session management** - Clears session on app close, requires login every time
- ✅ **Employee redirect** - Employees automatically redirected to assigned modules after login

### 4. **Flutter Salesman App Integration**
- ✅ Connected Flutter app login to ERP backend
- ✅ API endpoint `/api/salesman/auth/login` working
- ✅ Salesman credentials managed in ERP 18.1 module
- ✅ **Flutter App MongoDB Integration** - All Flutter app data now stored in MongoDB
  - Created MongoDB models: `SalesmanItem`, `SalesmanCustomer`, `SalesmanOrder`, `SalesmanHistory`
  - Created API routes: `/api/salesman-app/*` for all CRUD operations
  - Updated Flutter app to use `ApiStorageService` instead of local JSON storage
  - All data (Items, Customers, Orders, History) stored in same MongoDB database as ERP

---

## 🔲 What's Left to Do

### 1. **Backend Deployment to Ubuntu Server**
- ⬜ Install Node.js on Ubuntu server
- ⬜ Install MongoDB on Ubuntu server
- ⬜ Upload project files to server
- ⬜ Configure environment variables
- ⬜ Set up PM2 process manager
- ⬜ Configure firewall rules
- ⬜ (Optional) Set up Nginx reverse proxy

### 2. **Desktop App Configuration & Rebuild**
- ⬜ Update `api-config.json` with server IP/domain
- ⬜ Rebuild Windows .exe with cloud configuration
- ⬜ Test desktop app connection to cloud server

### 3. **Testing & Verification**
- ⬜ Test all modules work with cloud backend
- ⬜ Verify MongoDB data storage
- ⬜ Test Flutter Salesman app with cloud backend
- ⬜ Performance testing

### 4. **Distribution**
- ⬜ Package final .exe installer
- ⬜ Distribute to end users
- ⬜ Provide installation instructions

---

## 🚀 Step-by-Step Deployment Process

### **PHASE 1: Prepare Your Windows Development Machine**

#### Step 1.1: Update API Configuration
1. Open `api-config.json` in your project root
2. Update it with your Ubuntu server details:
   ```json
   {
     "apiBase": "http://YOUR_SERVER_IP:3000",
     "useCloudServer": true
   }
   ```
   **Example:**
   ```json
   {
     "apiBase": "http://192.168.1.100:3000",
     "useCloudServer": true
   }
   ```
   Or if you have a domain:
   ```json
   {
     "apiBase": "http://erp.yourcompany.com",
     "useCloudServer": true
   }
   ```

3. **Save the file**

#### Step 1.2: Rebuild Desktop Application
1. Open PowerShell/Command Prompt in your project directory:
   ```bash
   cd "D:\Medical ERP App"
   ```

2. Ensure all dependencies are installed:
   ```bash
   npm install
   ```

3. Build the Windows .exe:
   ```bash
   npm run build:win
   ```

4. **Wait for build to complete** (this may take 5-10 minutes)

5. **Locate your installer:**
   - Go to `dist/` folder
   - You'll find: `Medical ERP Setup 1.0.0.exe`
   - This is your cloud-ready desktop application installer

---

### **PHASE 2: Deploy Backend to Ubuntu Server**

#### Step 2.1: Connect to Ubuntu Server
1. **SSH into your Ubuntu server:**
   ```bash
   ssh username@your-server-ip
   ```
   Example: `ssh ubuntu@192.168.1.100`

2. **Update system packages:**
   ```bash
   sudo apt update
   sudo apt upgrade -y
   ```

#### Step 2.2: Install Node.js
1. **Add NodeSource repository:**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   ```

2. **Install Node.js:**
   ```bash
   sudo apt-get install -y nodejs
   ```

3. **Verify installation:**
   ```bash
   node --version
   npm --version
   ```
   Should show Node.js v18.x or higher

#### Step 2.3: Install MongoDB
1. **Import MongoDB public GPG key:**
   ```bash
   wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -
   ```

2. **Add MongoDB repository:**
   ```bash
   echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
   ```

3. **Update package list:**
   ```bash
   sudo apt-get update
   ```

4. **Install MongoDB:**
   ```bash
   sudo apt-get install -y mongodb-org
   ```

5. **Start MongoDB service:**
   ```bash
   sudo systemctl start mongod
   sudo systemctl enable mongod
   ```

6. **Verify MongoDB is running:**
   ```bash
   sudo systemctl status mongod
   ```
   Should show "active (running)"

#### Step 2.4: Install PM2 (Process Manager)
1. **Install PM2 globally:**
   ```bash
   sudo npm install -g pm2
   ```

2. **Verify installation:**
   ```bash
   pm2 --version
   ```

#### Step 2.5: Upload Project Files to Server

**Option A: Using SCP (from Windows PowerShell):**
```powershell
scp -r "D:\Medical ERP App" username@your-server-ip:/home/username/medical-erp
```

**Option B: Using FileZilla/WinSCP (GUI):**
1. Download FileZilla or WinSCP
2. Connect to your Ubuntu server (SFTP)
3. Upload entire project folder to `/home/username/medical-erp`

**Option C: Using Git (if you have a repository):**
```bash
# On Ubuntu server
cd /home/username
git clone your-repository-url medical-erp
cd medical-erp
```

#### Step 2.6: Install Project Dependencies on Server
1. **Navigate to project directory:**
   ```bash
   cd /home/username/medical-erp
   ```

2. **Install dependencies:**
   ```bash
   npm install --production
   ```
   (This installs only production dependencies, not dev dependencies)

#### Step 2.7: Configure Environment Variables
1. **Create `.env` file:**
   ```bash
   nano .env
   ```

2. **Add the following content:**
   ```
   MONGO_URI=mongodb://localhost:27017/medical_erp
   PORT=3000
   NODE_ENV=production
   ```

3. **Save and exit:**
   - Press `Ctrl + X`
   - Press `Y` to confirm
   - Press `Enter` to save

#### Step 2.8: Start Backend with PM2
1. **Start the application:**
   ```bash
   pm2 start server.js --name medical-erp
   ```

2. **Save PM2 configuration:**
   ```bash
   pm2 save
   ```

3. **Set up PM2 to start on boot:**
   ```bash
   pm2 startup
   ```
   This will output a command - **copy and run that command** (it will be something like `sudo env PATH=...`)

4. **Check PM2 status:**
   ```bash
   pm2 status
   ```
   Should show `medical-erp` as "online"

5. **View logs:**
   ```bash
   pm2 logs medical-erp
   ```
   You should see: `✅ MongoDB connected` and `✅ Server running at http://84.247.169.194`

#### Step 2.9: Configure Firewall
1. **Allow port 3000:**
   ```bash
   sudo ufw allow 3000/tcp
   ```

2. **Enable firewall:**
   ```bash
   sudo ufw enable
   ```

3. **Check firewall status:**
   ```bash
   sudo ufw status
   ```
   Should show port 3000 as "ALLOW"

#### Step 2.10: Test Backend API
1. **Test from server:**
   ```bash
   curl http://84.247.169.194/api/dashboard
   ```
   Should return JSON data

2. **Test from your Windows machine:**
   ```powershell
   curl http://YOUR_SERVER_IP:3000/api/dashboard
   ```
   Replace `YOUR_SERVER_IP` with actual IP

---

### **PHASE 3: (Optional) Set Up Nginx Reverse Proxy**

#### Step 3.1: Install Nginx
```bash
sudo apt install nginx -y
```

#### Step 3.2: Create Nginx Configuration
1. **Create config file:**
   ```bash
   sudo nano /etc/nginx/sites-available/medical-erp
   ```

2. **Add this configuration:**
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;  # Replace with your domain or IP

       location / {
           proxy_pass http://84.247.169.194;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

3. **Save and exit** (Ctrl+X, Y, Enter)

#### Step 3.3: Enable Site
```bash
sudo ln -s /etc/nginx/sites-available/medical-erp /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### Step 3.4: Update Firewall
```bash
sudo ufw allow 'Nginx Full'
```

**Note:** If using Nginx, update `api-config.json` to use port 80 instead of 3000:
```json
{
  "apiBase": "http://your-domain.com",
  "useCloudServer": true
}
```

---

### **PHASE 4: Test Desktop Application**

#### Step 4.1: Install Desktop App on Windows
1. **Locate the installer:**
   - Go to `D:\Medical ERP App\dist\`
   - Find `Medical ERP Setup 1.0.0.exe`

2. **Run the installer:**
   - Double-click the `.exe` file
   - Follow installation wizard
   - Choose installation directory
   - Complete installation

#### Step 4.2: Test Connection & Login Flow
1. **Launch the application:**
   - Open "Medical ERP" from Start Menu or Desktop shortcut
   - **Verify:** Login page appears immediately (not auto-logged in)

2. **Test Admin Login:**
   - Enter admin email and password
   - Click "Sign In"
   - **Expected:** Admin redirected to Dashboard with full access to all modules
   - Open browser DevTools (F12) → Network tab
   - Verify API calls go to your server IP (not localhost)

3. **Test Employee Login:**
   - Close the app completely
   - Reopen the app
   - **Verify:** Login page appears again (session cleared)
   - Login with employee credentials (from 17.1 Roles & Permissions)
   - **Expected:** Employee redirected to their first assigned module
   - **Verify:** Only assigned modules visible in sidebar (other modules hidden)

4. **Verify Data Storage on Server:**
   - After adding data in any module, check MongoDB on server:
     ```bash
     mongo
     use medical_erp
     show collections
     db.salesmen.find()
     db.discountClaims.find()
     ```
   - **Verify:** All new data appears in MongoDB (stored on 100GB server)

---

### **PHASE 5: Final Testing & Verification**

#### Step 5.1: Test All Modules
- [ ] Login/Logout
- [ ] Dashboard loads data
- [ ] Add/Edit/Delete in Salesman Department
- [ ] Add data in Discount Claims
- [ ] Add data in other modules
- [ ] Verify data appears in MongoDB

#### Step 5.2: Test Flutter Salesman App
1. **Update Flutter app API URL:**
   - Open `faizan_medicine/faizan_medicine/lib/screens/login.dart`
   - Change `_apiBase` to your server IP:
     ```dart
     static const String _apiBase = 'http://YOUR_SERVER_IP:3000';
     ```

2. **Rebuild Flutter app:**
   ```bash
   cd faizan_medicine/faizan_medicine
   flutter build windows
   ```

3. **Test login:**
   - Run Flutter app
   - Login with credentials from ERP 18.1 module
   - Should connect to cloud server

#### Step 5.3: Performance Check
- [ ] API response times acceptable
- [ ] No connection errors
- [ ] Data saves correctly
- [ ] MongoDB queries work

---

## 📝 Post-Deployment Checklist

### Server Maintenance
- [ ] Set up MongoDB backups (daily/weekly)
- [ ] Monitor PM2 logs regularly
- [ ] Set up server monitoring (optional)
- [ ] Configure SSL/HTTPS (recommended)
- [ ] Document server IP/credentials securely

### Application Updates
- [ ] Create update process documentation
- [ ] Set up version control (Git)
- [ ] Plan for future updates

### User Distribution
- [ ] Package final .exe installer
- [ ] Create user installation guide
- [ ] Provide support contact information
- [ ] Test installer on clean Windows machine

### Security
- [ ] Change default MongoDB password (if applicable)
- [ ] Set up firewall rules properly
- [ ] Use HTTPS for production (Let's Encrypt)
- [ ] Regular security updates

---

## 🔧 Troubleshooting Guide

### Desktop App Can't Connect to Server
**Problem:** App shows connection error

**Solutions:**
1. Check server IP in `api-config.json` is correct
2. Verify firewall allows port 3000: `sudo ufw status`
3. Test from browser: `http://YOUR_SERVER_IP:3000/api/dashboard`
4. Check PM2 is running: `pm2 status`
5. Check server logs: `pm2 logs medical-erp`

### MongoDB Connection Issues
**Problem:** Backend can't connect to MongoDB

**Solutions:**
1. Check MongoDB is running: `sudo systemctl status mongod`
2. Verify MONGO_URI in `.env` file
3. Check MongoDB logs: `sudo tail -f /var/log/mongodb/mongod.log`

### PM2 Process Crashes
**Problem:** Application stops running

**Solutions:**
1. Check logs: `pm2 logs medical-erp`
2. Restart: `pm2 restart medical-erp`
3. Check for errors in `server.js`
4. Verify all dependencies installed: `npm install`

### Data Not Saving to MongoDB
**Problem:** Data appears in JSON but not MongoDB

**Solutions:**
1. Check MongoDB connection in logs
2. Verify `mongoSync.js` is working
3. Check MongoDB collections: `mongo` → `use medical_erp` → `show collections`

---

## 📞 Quick Reference Commands

### Server Commands
```bash
# Check PM2 status
pm2 status

# View logs
pm2 logs medical-erp

# Restart app
pm2 restart medical-erp

# Stop app
pm2 stop medical-erp

# MongoDB shell
mongo
use medical_erp
show collections
db.salesmen.find()

# Check firewall
sudo ufw status

# Check Node.js version
node --version

# Check MongoDB status
sudo systemctl status mongod
```

### Windows Build Commands
```bash
# Install dependencies
npm install

# Build Windows .exe
npm run build:win

# Build Linux AppImage (on Linux)
npm run build:linux

# Run in development
npm start
```

---

## 📦 Files Created/Modified

### New Files:
- `api-config.json` - API endpoint configuration
- `config.js` - API config loader (optional)
- `models/Salesman.js` - MongoDB model
- `mongoSync.js` - JSON to MongoDB sync
- `db.js` - MongoDB connection
- `CLOUD_DEPLOYMENT.md` - Detailed deployment guide
- `BUILD_INSTRUCTIONS.md` - Build instructions
- `COMPLETE_DEPLOYMENT_GUIDE.md` - This file

### Modified Files:
- `package.json` - Added electron-builder and build config
- `main.js` - Added cloud server support
- `renderer.js` - Updated to use cloud API
- `login.html` - Updated to use cloud API
- `routes/salesmanDepartment.js` - Converted to MongoDB
- `server.js` - Added MongoDB connection

---

## ⚠️ Critical Notes

### **Data Storage - IMPORTANT**
- **ALL ERP data is stored on the 100GB Linux server**
- Desktop app (.exe) does NOT store any data locally
- Every data operation (add, edit, delete) goes to the server
- MongoDB database on server = Single source of truth
- Users' Windows PCs are just client interfaces

### **Login Behavior - CONFIRMED**
- ✅ **App ALWAYS starts at login page** - No auto-login
- ✅ **Session cleared on app close** - Must login every time
- ✅ **Admin login** → Full access to all modules
- ✅ **Employee login** → Redirected to assigned modules only
- ✅ **Module access** → Based on Roles & Permissions (17.1 module)

### **Server Requirements**
- **100GB Linux Server** = All data storage
- **MongoDB** = Database for all ERP data
- **Node.js Backend** = API server handling all requests
- **PM2** = Keeps backend running 24/7

---

## ✅ Success Criteria

Your deployment is successful when:
1. ✅ Backend runs on Ubuntu server (100GB) and accessible via IP
2. ✅ **MongoDB stores ALL data on server** (not on user's PC)
3. ✅ Desktop app connects to cloud server (not localhost)
4. ✅ **Login page appears every time app starts** (no auto-login)
5. ✅ **Admin gets full access, employees get assigned modules only**
6. ✅ Users can login and use all features
7. ✅ Flutter Salesman app connects to cloud server
8. ✅ PM2 keeps backend running automatically
9. ✅ Data persists after server restart
10. ✅ **All data operations save to server MongoDB**

---

## 🎯 Next Steps After Deployment

1. **Monitor for 24-48 hours** to ensure stability
2. **Collect user feedback** on performance
3. **Set up automated backups** for MongoDB
4. **Plan for scaling** if user base grows
5. **Document any custom configurations** for future reference

---

**End of Deployment Guide**

*Last Updated: [Current Date]*
*Version: 1.0*

