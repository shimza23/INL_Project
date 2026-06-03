const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    // Hardcoded clean connection string - no extra parameters
    const mongoURI = "mongodb+srv://BCAdmin:HadDUMrnxAcNpDkC@inl381database.gptucqo.mongodb.net/smarttuner";
    
    console.log("🔄 Connecting to MongoDB Atlas...");
    await mongoose.connect(mongoURI);
    console.log("✅ MongoDB Atlas Connected Successfully");
  } catch (error) {
    console.error("❌ MongoDB Connection failed:", error.message);
    console.log("\n⚠️ Server will continue running but database features won't work");
  }
};

module.exports = connectDB;