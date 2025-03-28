// middleware/auth.mjs
export default function ensureLoggedIn(req, res, next) {
    if (req.isAuthenticated() && req.user) {  // Checks if user is authenticated via Passport
        return next();
    }
    return res.redirect('/auth/login');
}
