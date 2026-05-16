require('dotenv').config({quiet: true})
const mongoose = require("mongoose")

const connectDB = async () => {
  try {
     //this will change depending on the connection and the database name used later
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB Connected");
  } catch (error) {
    //simple errror handling to display the error if there is one
    console.error("Connection failed:", error);
  }
};

module.exports = connectDB;