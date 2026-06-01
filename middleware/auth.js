// Require authentication middleware
function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
}

// Require specific role(s) middleware
function requireRole(roles) {
  return (req, res, next) => {
    if (!req.session.user) {
      return res.redirect('/login');
    }
    if (roles.includes(req.session.user.role)) {
      next();
    } else {
      res.status(403).send('Access denied');
    }
  };
}

// Make user available to all views
function setUserLocals(req, res, next) {
  res.locals.user = req.session.user || null;
  next();
}

module.exports = { requireAuth, requireRole, setUserLocals };