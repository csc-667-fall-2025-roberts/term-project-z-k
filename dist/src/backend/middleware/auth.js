"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auth = auth;
exports.loggedIn = loggedIn;
function auth(req, res, next) {
    const userId = req.session?.userId;
    if (!userId) {
        if (req.path.includes('/api/')) {
            return res.status(401).json({
                error: 'Authentication required'
            });
        }
        return res.redirect('/signup');
    }
    next();
}
function loggedIn(req, res, next) {
    const userId = req.session?.userId;
    if (userId && req.path.includes('signup') || userId && req.path.includes('login')) {
        return res.redirect('/lobby');
    }
    next();
}
