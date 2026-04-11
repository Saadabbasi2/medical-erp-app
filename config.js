// config.js - API Configuration
// Set this to your cloud server URL when deploying
const API_CONFIG = {
  // For local development
  // apiBase: 'http://84.247.169.194',

  // For cloud deployment - replace with your Ubuntu server IP/domain
  apiBase: process.env.API_BASE_URL || 'http://84.247.169.194',

  // Set to true if backend runs on cloud server (don't start local server)
  useCloudServer: process.env.USE_CLOUD_SERVER === 'true' || false
};

module.exports = API_CONFIG;

