const mongoose = require("mongoose");
require('dotenv').config();

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGO_URI;
    
    if (!mongoURI) {
      throw new Error("MONGO_URI is not defined in .env file");
    }
    
    console.log("🔄 Connecting to MongoDB Atlas...");
    await mongoose.connect(mongoURI);
    console.log("✅ MongoDB Atlas Connected Successfully");
  } catch (error) {
    console.error("❌ MongoDB Connection failed:", error.message);
    process.exit(1);
  }
};

module.exports = connectDB;