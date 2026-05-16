//set all needed variables 

const express = require('express');
const path    = require('path');
const app     = express();
const dotenv  = require('dotenv').config({quiet: true})
const port    = process.env.PORT || 3000;
const DB = require('./connection'); // if needed

//Connect DB
DB.connectDB

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.static('public'));

//set routing
app.get('/', (req, res) => { res.render('index'); });
app.get('/login', (req, res) => { res.render('login'); });
app.get('/dashboard', (req, res) => { res.render('dashboard'); }); // fix filename too
app.get('/manage', (req, res) => { res.render('manage'); });
app.get('/authentication', (req, res) => { res.render('authentication'); });

//set server
app.listen(port, () => {
  console.log(`Server is running on localhost:${port}`);
});