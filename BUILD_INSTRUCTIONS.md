# Building Medical ERP Desktop Application

## Prerequisites

1. **Node.js** (v16 or higher) - [Download](https://nodejs.org/)
2. **npm** (comes with Node.js)
3. **Windows** (for building .exe) or **Linux** (for building AppImage)

## Step 1: Install Dependencies

```bash
npm install
```

This will install all required packages including `electron-builder`.

## Step 2: Build Windows .exe

```bash
npm run build:win
```

This will:
- Create a `dist` folder
- Generate a Windows installer (.exe) in `dist/`
- The installer will be named something like `Medical ERP Setup 1.0.0.exe`

## Step 3: Build Linux AppImage (for Ubuntu)

```bash
npm run build:linux
```

This will create an AppImage file in `dist/` that can run on Ubuntu.

## Step 4: Install the Application

### Windows:
- Run the `.exe` installer from `dist/` folder
- Follow the installation wizard
- The app will be installed and shortcuts created

### Linux:
- Make the AppImage executable: `chmod +x Medical\ ERP-1.0.0.AppImage`
- Run it: `./Medical\ ERP-1.0.0.AppImage`

## Notes

- The built application includes:
  - All frontend files (HTML, CSS, JS)
  - Backend server (Node.js/Express)
  - MongoDB connection (requires MongoDB to be running)
  - All data files and assets

- **Important**: Users need to have:
  - Node.js installed (for the backend server)
  - MongoDB running (for database)
  - Or you can bundle Node.js and MongoDB with the installer (advanced)

## Troubleshooting

- If build fails, ensure all dependencies are installed: `npm install`
- For Windows builds, you might need Visual Studio Build Tools
- For Linux builds, ensure you have required libraries installed

