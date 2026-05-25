//set all needed variables 
const express = require('express');
const path    = require('path');
const app     = express();
const dotenv  = require('dotenv').config({quiet: true});
const port    = process.env.PORT || 3000;
const cookieParser     = require("cookie-parser");
const localsMiddleware = require("./middleware/localsMiddleware");
const DB = require('./connection');

//Connect DB
DB.connectDB;

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.static('public'));

//middleware
app.use(express.json());                            
app.use(express.urlencoded({ extended: false }));   
app.use(cookieParser());

app.use(localsMiddleware.setLocals)


//set routing
app.get('/', (req, res) => { res.render('index'); });
app.get('/admin-analytics', (req, res) => { res.render('admin-analytics'); });
app.get('/book-session', (req, res) => { res.render('book-session'); });
app.get('/login', (req, res) => { res.render('login'); });
app.get('/my-bookings', (req, res) => { res.render('my-bookings'); });
app.get("/notifications", (req, res) => { res.render('notifications'); });
app.get('/profile-settings', (req, res) => { res.render('profile-settings'); });
app.get("/student-dashboard", (req,res) => {res.render('student-dashboard');});
app.get("/student-requests", (req,res) => {res.render('student-requests');});
app.get("/tutor-dashboard", (req,res) => {res.render('tutor-dashboard');});

//set server
app.listen(port, () => {
  console.log(`Server is running on localhost:${port}`);
});