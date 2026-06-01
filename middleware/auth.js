const jwt = require("jsonwebtoken");

const setLocals = (req, res, next) => {
    const token = req.cookies.token;
    
    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            res.locals.user = decoded;
            // Also sync with session for backward compatibility
            req.session.user = decoded;
        } catch (err) {
            res.locals.user = null;
        }
    } else {
        res.locals.user = null;
    }
    next();
};

// Middleware to protect routes
const requireAuth = (req, res, next) => {
    const token = req.cookies.token;
    
    if (!token && !req.session.user) {
        return res.redirect('/login');
    }
    
    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = decoded;
            next();
        } catch (err) {
            res.clearCookie('token');
            req.session.destroy();
            return res.redirect('/login');
        }
    } else if (req.session.user) {
        req.user = req.session.user;
        next();
    } else {
        res.redirect('/login');
    }
};

// Role-based middleware
const requireRole = (roles) => {
    return (req, res, next) => {
        const user = req.user || res.locals.user;
        if (!user) {
            return res.redirect('/login');
        }
        if (roles.includes(user.role)) {
            next();
        } else {
            res.status(403).send('Access denied');
        }
    };
};

module.exports = { setLocals, requireAuth, requireRole };