// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

// Imports
import express from 'express';
import session from 'express-session';
import mongoose from 'mongoose';
import path from 'path';
import MongoStore from 'connect-mongo';
import { fileURLToPath } from 'url';
import hbs from 'hbs';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from './models/User.mjs';
import Stripe from 'stripe';

// Initialize Stripe with secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/resource_rite')
.then(() => console.log("MongoDB connected"))
.catch(err => console.error("MongoDB connection error:", err));

// Middleware for parsing request bodies
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session configuration
app.use(session({
    secret: 'keyboard cat',  // 🔑 Don't change this once deployed
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGO_URI || 'mongodb://localhost:27017/resource_rite',
        ttl: 24 * 60 * 60  // 1 day
    }),
    cookie: {
        secure: false,       //  must be false for local dev (http)
        httpOnly: true,      // protects against XSS
        maxAge: 1000 * 60 * 60 * 24  // 1 day in milliseconds
    }
}));

// Initialize Passport for authentication
app.use(passport.initialize());
app.use(passport.session());

// Middleware to make current user available in templates (Integrated solution)
app.use(async (req, res, next) => {
    try {
        let userId = null;

        if (req.session.passport && req.session.passport.user) {
            userId = req.session.passport.user;
        } else if (req.session.userId) {
            userId = req.session.userId;
        }

        if (userId) {
            const user = await User.findById(userId);
            req.user = user;
            res.locals.currentUser = user;
        } else {
            res.locals.currentUser = null;
        }

        next();
    } catch (error) {
        console.error("Error fetching user:", error);
        res.locals.currentUser = null;
        next();
    }
});



// Set up Handlebars as the view engine
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// Register Handlebars helpers
hbs.registerHelper('eq', function(a, b) { return a === b; });
hbs.registerHelper('not', function(value) { return !value; });

// Import routes
import authRoutes from './routes/auth.mjs';
import productRoutes from './routes/products.mjs';
import profileRoutes from './routes/profile.mjs';
import paymentRoutes from './routes/payment.mjs';


// Use routes
app.use('/', productRoutes);
app.use('/auth', authRoutes);
app.use('/user', profileRoutes);
// app.use('/products', productRoutes);
app.use('/payment', paymentRoutes);


// Google OAuth Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      let user = await User.findOne({ googleId: profile.id });

      if (!user) {
        user = await User.create({ googleId: profile.id, username: profile.displayName });
      }
      
      return done(null, user);
    } catch (error) {
      return done(error, null);
    }
  }
));

// Configure Passport to handle sessions correctly
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));

