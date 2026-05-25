// 1. Force Node.js to use public DNS Cloudflare: '1.1.1.1' Google DNS: '8.8.8.8'
const dns = require('dns');
dns.setServers(['1.1.1.1', '8.8.8.8']); 

// 2. Load environment variables
require('dotenv').config({ quiet: true });
const mongoose = require("mongoose");

// 3. Connect to the database
const connectDB = mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("Connected to MongoDB successfully."))
  .catch(err => console.error("Mongoose connection error:", err));

module.exports = connectDB;
