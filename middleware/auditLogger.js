// ======================= middleware/auditLogger.js =======================
const fs = require("fs");
const path = require("path");

const auditFile = path.join(__dirname, "..", "data", "auditTrail.json");

// ---------- Safe File Handlers ----------
function readSafe() {
  try {
    return JSON.parse(fs.readFileSync(auditFile, "utf8") || "[]");
  } catch {
    return [];
  }
}
function writeSafe(data) {
  fs.writeFileSync(auditFile, JSON.stringify(data, null, 2));
}

// ---------- Middleware Factory ----------
function auditLogger(req, res, next) {
  const methodsToLog = ["POST", "PUT", "PATCH", "DELETE"];

  // Only log modifying requests
  if (!methodsToLog.includes(req.method)) return next();

  const oldSend = res.send;
  res.send = function (body) {
    try {
      const moduleName = req.originalUrl.split("/")[2] || "Unknown Module";
      const user = (req.user && req.user.name) || "System";

      const action =
        req.method === "POST"
          ? "Create"
          : req.method === "PUT"
          ? "Update"
          : req.method === "PATCH"
          ? "Approve/Modify"
          : req.method === "DELETE"
          ? "Delete"
          : "Action";

      // Safely format new value
      const safeBody =
        req.body && Object.keys(req.body).length > 0
          ? req.body
          : { info: "No body data" };

      const newValue = (() => {
        try {
          const json = JSON.stringify(safeBody);
          return json.length > 300 ? json.substring(0, 300) + "..." : json;
        } catch {
          return "Unstringifiable data";
        }
      })();

      const logs = readSafe();
      logs.push({
        id: Date.now(),
        module: moduleName,
        field: Object.keys(req.body || {}).join(", ") || "N/A",
        oldValue: "",
        newValue,
        user,
        action,
        timestamp: new Date().toISOString(),
      });
      writeSafe(logs);
    } catch (err) {
      console.error("Audit logging failed:", err);
    }

    return oldSend.call(this, body);
  };

  next();
}

module.exports = auditLogger;
