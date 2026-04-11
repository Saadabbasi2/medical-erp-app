// ======================= routes/helpAndUtilities.js =======================
const express = require("express");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const router = express.Router();

const complaintsFile = path.join(__dirname, "..", "data", "complaints.json");
const dataDir = path.join(__dirname, "..", "data");

// Helpers
function readSafe(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8") || "[]"); }
  catch { return []; }
}
function writeSafe(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ============ HELP / ABOUT ============
router.get("/about", (req, res) => {
  res.json({
    name: "H.M.A & SONS ,Faizan Medicine Comapny",
    version: "v3.0.0",
    developer: "AuxWork PVt LTD",
    supportEmail: "support@auxwork.com",
    releaseDate: "2025-11-10"
  });
});

// ============ ADD COMPLAINT ============
router.get("/complaints", (req, res) => res.json(readSafe(complaintsFile)));

router.post("/complaints", (req, res) => {
  const complaints = readSafe(complaintsFile);
  const newComplaint = {
    id: Date.now(),
    user: req.body.user || "Anonymous",
    type: req.body.type || "General",
    message: req.body.message || "",
    status: "Open",
    createdAt: new Date().toISOString()
  };
  complaints.push(newComplaint);
  writeSafe(complaintsFile, complaints);
  res.json({ success: true, data: newComplaint });
});

// ============ DATA FILE VIEWER ============
router.get("/data-files", (req, res) => {
  const files = fs.readdirSync(dataDir).filter(f => f.endsWith(".json"));
  res.json(files);
});

router.get("/data-files/:fileName", (req, res) => {
  const filePath = path.join(dataDir, req.params.fileName);
  if (!fs.existsSync(filePath))
    return res.status(404).json({ success: false, message: "File not found" });
  const content = readSafe(filePath);
  res.json(content);
});

// ============ QUICK TOOL LAUNCHERS ============
router.post("/launch", (req, res) => {
  const { app } = req.body;
  const commands = {
    word: "start winword",
    excel: "start excel",
    powerpoint: "start powerpnt",
    outlook: "start outlook",
    notepad: "start notepad"
  };
  const cmd = commands[app];
  if (!cmd) return res.status(400).json({ success: false, message: "Unsupported tool" });

  exec(cmd, err => {
    if (err) return res.status(500).json({ success: false, message: "Failed to launch" });
    res.json({ success: true, message: `${app} launched successfully` });
  });
});


module.exports = router;
