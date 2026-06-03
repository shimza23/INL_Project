//set all needed variables 
const express = require('express');
const path    = require('path');
const app     = express();
const dotenv  = require('dotenv').config();
const port    = process.env.PORT || 3000;

require('./connection'); // if needed

app.set('views', path.join(__dirname, 'Views'));
app.set('view engine', 'ejs');
app.use(express.static('public'));

//set routing
app.get('/', (req, res) => { res.render('index'); });
app.get('/contact', (req, res) => { res.render('contact'); });
app.get('/dashboard', (req, res) => { res.render('dashboard'); }); // fix filename too
app.get('/manage', (req, res) => { res.render('manage'); });
app.get('/authentication', (req, res) => { res.render('authentication'); });

//set server
if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server is running on localhost:${port}`);
  });
}

module.exports = app;