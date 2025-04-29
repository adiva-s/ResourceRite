import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import bcrypt from 'bcrypt';
import User from '../models/User.mjs';
import passport from 'passport';
import nodemailer from 'nodemailer';
import crypto from 'crypto';


const router = express.Router();
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});


// GET /auth/signup - show signup form
router.get('/signup', (req, res) => { 
    res.render('signup'); 
});

// POST /auth/signup - handle new user registration
// POST /auth/signup - handle new user registration
router.post('/signup', async (req, res) => {
    try {
        let { name, username, email, password, confirmPassword, role } = req.body;

        if (password !== confirmPassword) {
            return res.render('signup', { message: "❗ Passwords do not match!" });
        }

        // Password strength validation
        const passwordRegex = /^(?=.*[0-9])(?=.*[!@#$%^&*])[A-Za-z0-9!@#$%^&*]{8,}$/;
        if (!passwordRegex.test(password)) {
            return res.render('signup', { message: "❗ Password must be at least 8 characters, include a number and a special character." });
        }

        // Auto-lowercase username
        username = username.toLowerCase();

        // Email uniqueness check
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.render('signup', { message: "❗ Email already in use!" });
        }

        // Username uniqueness check
        const existingUsername = await User.findOne({ username });
        if (existingUsername) {
            return res.render('signup', { message: "❗ Username already taken. Please choose another one." });
        }

        const hashedPassword = bcrypt.hashSync(password, 10);

        const newUser = await User.create({
            name,
            username,
            email,
            password: hashedPassword,
            role
        });

        // Render a welcome page instead of redirecting right away
        res.render('signupSuccess', { name: newUser.name });

    } catch (err) {
        console.error(err);
        res.render('signup', { message: "Something went wrong. Try again." });
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

// GET / Show forgot password form
router.get('/forgot', (req, res) => {
    res.render('forgot', { message: "✅ A password reset link has been sent to your email." });
});
 
// POST / Handle password reset request
router.post('/forgot', async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.render('forgot', { message: "❗ No account found with that email." });
        }

        // Generate secure token
        const token = crypto.randomBytes(32).toString('hex');
        const expiry = Date.now() + 3600000; // 1 hour

        // Save token to user
        user.resetPasswordToken = token;
        user.resetPasswordExpires = expiry;
        await user.save();

        // Build reset link
        const resetLink = `http://localhost:3000/auth/reset/${token}`;

        // Send email
        await transporter.sendMail({
            to: user.email,
            from: process.env.EMAIL_USER,
            subject: 'Password Reset Request - ResourceRite',
            html: `
                <h3>Reset Your Password</h3>
                <p>Click the link below to reset your password:</p>
                <a href="${resetLink}">${resetLink}</a>
                <p>This link will expire in 1 hour.</p>
            `
        });

        res.render('forgot', { message: "✅ A password reset link has been sent to your email." });
    } catch (err) {
        console.error("❌ Error in forgot route:", err);
        res.render('forgot', { message: "⚠️ Something went wrong. Please try again." });
    }
});

// GET /auth/reset/:token
router.get('/reset/:token', async (req, res) => {
    try {
        const user = await User.findOne({
            resetPasswordToken: req.params.token,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.send("❌ Invalid or expired token.");
        }

        res.render('resetPassword', { token: req.params.token });
    } catch (err) {
        console.error("⚠️ Error loading reset form:", err);
        res.send("Something went wrong.");
    }
});

// POST /auth/reset/:token
router.post('/reset/:token', async (req, res) => {
    try {
        const { password, confirmPassword } = req.body;

        if (password !== confirmPassword) {
            return res.send("❗Passwords do not match.");
        }

        const user = await User.findOne({
            resetPasswordToken: req.params.token,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.send("❌ Token is invalid or has expired.");
        }

        // Hash new password
        const hashedPassword = bcrypt.hashSync(password, 10);
        user.password = hashedPassword;

        // Clear token fields
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;

        await user.save();

        // Log them in or show success
        res.render('resetSuccess');
    } catch (err) {
        console.error("❌ Error resetting password:", err);
        res.send("⚠️ Something went wrong. Try again.");
    }
});

// GET /auth/check-username?username=whatever
router.get('/auth/check-username', async (req, res) => {
    const { username } = req.query;
    if (!username) {
        return res.json({ available: false });
    }

    const existingUser = await User.findOne({ username: username.toLowerCase() });

    if (existingUser) {
        return res.json({ available: false });
    } else {
        return res.json({ available: true });
    }
});


export default router;
