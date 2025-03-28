// products.mjs 

// import statements
import express from 'express';
import User from '../models/User.mjs';
import Product from '../models/Product.mjs';
import ensureLoggedIn from '../middleware/auth.mjs';
import Stripe from 'stripe';
import dotenv from 'dotenv';
dotenv.config();

const router = express.Router();

const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);

// GET / - Home page showing product listings
router.get('/', async (req, res) => {
    try {
        const { category, minPrice, maxPrice, keyword } = req.query;
        let filter = {};

        if (category && category !== 'All') filter.category = category;

        if (minPrice || maxPrice) {
            filter.price = {};
            if (minPrice) filter.price.$gte = Number(minPrice);
            if (maxPrice) filter.price.$lte = Number(maxPrice);
        }

        if (keyword) {
            filter.$or = [
                { name: new RegExp(keyword, 'i') },
                { description: new RegExp(keyword, 'i') }
            ];
        }

        const products = await Product.find(filter).populate('seller');
        res.render('index', { products, query: req.query });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error retrieving products');
    }
});

// Route: Show individual product details
router.get('/products/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id).populate('seller');
        if (!product) return res.status(404).send('Product not found');

        const currentUser = req.session.userId ? await User.findById(req.session.userId) : null;
        const message = req.session.message || null;
        delete req.session.message; // Clear the message after displaying

        res.render('product', { product, currentUser, message });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error loading product.');
    }
});

// Add product to wishlist
router.post('/products/:id/wishlist', ensureLoggedIn, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        const product = await Product.findById(req.params.id);

        if (!user || !product) return res.redirect('/');

        if (!user.wishlist.includes(product._id)) {
            user.wishlist.push(product._id);
            await user.save();
            req.session.message = "✅ Item added to Wishlist successfully!";
        } else {
            req.session.message = "⚠️ Item already exists in your Wishlist.";
        }

        res.redirect(`/products/${product._id}`);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error adding to wishlist.');
    }
});

// Add product to saved items
router.post('/products/:id/save', ensureLoggedIn, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        const product = await Product.findById(req.params.id);

        if (!user || !product) return res.redirect('/');

        if (!user.savedItems.includes(product._id)) {
            user.savedItems.push(product._id);
            await user.save();
            req.session.message = "✅ Item saved successfully!";
        } else {
            req.session.message = "⚠️ Item already exists in your Saved Items.";
        }

        res.redirect(`/products/${product._id}`);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error saving item.');
    }
});

// POST /products/:id/add-to-cart - Add item to cart
router.post('/products/:id/add-to-cart', async (req, res) => {
    if (!req.user) {
        console.log("User is not logged in.");
        return res.redirect('/auth/login');
    }

    try {
        if (!req.session.cart) req.session.cart = [];  // Initialize the cart if it doesn't exist

        if (!req.session.cart.includes(req.params.id)) {
            req.session.cart.push(req.params.id);
            console.log("✅ Item added to cart:", req.session.cart);
        }

        res.redirect(`/cart?message=Item added to cart successfully!`);
    } catch (error) {
        console.error("Error adding product to cart:", error);
        res.status(500).send('Server error.');
    }
});

// GET /cart - Display cart page
router.get('/cart', async (req, res) => {
    const message = req.query.message; // Get the message from the URL
    if (!req.session.cart || req.session.cart.length === 0) {
        return res.render('cart', { products: [], total: 0, message });
    }

    try {
        const products = await Product.find({ _id: { $in: req.session.cart } });

        // Calculate total price
        const total = products.reduce((sum, product) => sum + product.price, 0);

        res.render('cart', { products, total, message });
    } catch (error) {
        console.error("Error loading cart:", error);
        res.status(500).send('Server error.');
    }
});


// POST /checkout - Checkout and pay with Stripe
router.post('/checkout', ensureLoggedIn, async (req, res) => {
    try {
        const products = await Product.find({ _id: { $in: req.session.cart } });

        if (products.length === 0) return res.redirect('/cart');

        const lineItems = products.map(product => ({
            price_data: {
                currency: 'usd',
                product_data: {
                    name: product.name,
                },
                unit_amount: product.price * 100,
            },
            quantity: 1,
        }));

        const session = await stripeClient.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: lineItems,
            mode: 'payment',
            success_url: 'http://localhost:3000/payment/success',
            cancel_url: 'http://localhost:3000/payment/cancel',
        });

        res.redirect(303, session.url);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error processing payment.');
    }
});

// GET /payment/success - Payment success page
router.get('/payment/success', (req, res) => {
    req.session.cart = [];  // Clear the cart only if payment is successful
    res.send('Payment Successful! Thank you for your purchase.');
});

// GET /payment/cancel - Payment cancel page
router.get('/payment/cancel', (req, res) => {
    res.send('Payment Cancelled. You can try again.');
});

export default router;
