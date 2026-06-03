require('dotenv').config();

const express = require('express');
const path = require('path');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const methodOverride = require('method-override');
const connectDB = require('./connection');
const { setUserLocals } = require('./middleware/auth');

const app = express();
const port = process.env.PORT || 3000;

// Connect to MongoDB
connectDB();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
app.use(cookieParser());
app.use(express.static('Public'));

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'smarttutor-secret',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

// Make user available to all templates
app.use(setUserLocals);

// Set EJS as view engine
app.set('views', path.join(__dirname, 'Views'));
app.set('view engine', 'ejs');

// Initialize subjects in database
const Subject = require('./Models/Subject');
async function initializeSubjects() {
  try {
    const count = await Subject.countDocuments();
    if (count === 0) {
      const subjects = [
        { code: 'WPR37(8)1', name: 'Web Programming', icon: '🌐', description: 'JavaScript, Node.js, EJS', yearLevel: 3 },
        { code: 'DBD37(8)1', name: 'Database Design', icon: '🗄️', description: 'MongoDB, Data Modelling', yearLevel: 3 },
        { code: 'MLG37(8)1', name: 'Machine Learning', icon: '🤖', description: 'Prediction, Classification', yearLevel: 3 },
        { code: 'DAL371', name: 'Data Analytics', icon: '📊', description: 'Power BI, Dashboards', yearLevel: 3 },
        { code: 'PRG271', name: 'Programming', icon: '💻', description: 'C#, OOP, Algorithms', yearLevel: 2 },
        { code: 'LPR271', name: 'Linear Programming', icon: '📐', description: 'Optimisation, Simplex', yearLevel: 2 },
        { code: 'UAX37(8)1', name: 'UX Design', icon: '🎨', description: 'Figma, Prototyping', yearLevel: 3 },
        { code: 'CYB371', name: 'Cybersecurity', icon: '🔒', description: 'Auth, Encryption, OWASP', yearLevel: 3 }
      ];
      await Subject.insertMany(subjects);
      console.log('✓ Subjects initialized');
    }
  } catch (error) {
    console.log('⚠️ Could not initialize subjects:', error.message);
  }
}

// Import routes
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const profileRoutes = require('./routes/profile');
const apiRoutes = require('./routes/api');

// Use routes
app.use('/', authRoutes);
app.use('/', dashboardRoutes);
app.use('/', profileRoutes);
app.use('/api', apiRoutes);

// Home page
app.get('/', (req, res) => {
  if (req.session.user) {
    return res.redirect(`/${req.session.user.role}-dashboard`);
  }
  res.render('index');
});

//set server
if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server is running on localhost:${port}`);
  });
}

module.exports = app;
