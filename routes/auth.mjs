import express from 'express';
import bcrypt from 'bcrypt';
import User from '../models/User.mjs';
import passport from 'passport';

const router = express.Router();

// GET /auth/signup - show signup form
router.get('/signup', (req, res) => { 
    res.render('signup'); 
});

// POST /auth/signup - handle new user registration
router.post('/signup', async (req, res) => {
    try {
        const { username, password, role } = req.body;

        const hashedPassword = bcrypt.hashSync(password, 10);

        const newUser = await User.create({ username, password: hashedPassword, role });

        req.session.userId = newUser._id;
        res.redirect('/user/profile');
    } catch (err) {
        console.error(err);
        res.redirect('/auth/signup');
    }
});

// GET /auth/login - show login form
router.get('/login', (req, res) => { 
    res.render('login'); 
});

// POST /auth/login - authenticate user
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });

        if (user && bcrypt.compareSync(password, user.password)) {
            req.session.userId = user._id;
            res.redirect('/');
        } else {
            res.redirect('/auth/login');
        }
    } catch (err) {
        console.error(err);
        res.redirect('/auth/login');
    }
});

// GET /auth/logout - log the user out
router.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
});

// Google OAuth Routes
router.get('/google', passport.authenticate('google', { scope: ['profile'] }));

router.get('/google/callback', 
    passport.authenticate('google', { failureRedirect: '/auth/login' }), 
    async (req, res) => {
        try {
            const { id, displayName } = req.user;
            
            // Check if the user already exists
            let user = await User.findOne({ googleId: id });

            if (!user) {
                // If user doesn't exist, create a new one
                user = await User.create({
                    username: displayName || `user-${id}`, // Fallback to generic username if none exists
                    name: displayName, // Store the display name for Google OAuth users
                    googleId: id
                });
            }

            // Log the user in by setting their session
            req.session.userId = user._id;
            res.redirect('/');
        } catch (error) {
            console.error(error);
            res.redirect('/auth/login');
        }
    }
);

export default router;
