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

// Middleware to initialize the cart if not exists
router.use((req, res, next) => {
    if (!req.session.cart) req.session.cart = {};  // Ensure the cart is an object
    next();
});


// GET / - Home page showing product listings
router.get('/', async (req, res) => {
    try {
        const products = await Product.find();
        res.render('index', { products });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error loading products.');
    }
});


// ✅ New Route: Show individual product details
router.get('/products/:id', async (req, res) => {
    try {
        // Find the product and populate the 'seller' field (if it exists in your model)
        const product = await Product.findById(req.params.id).populate('seller'); 

        if (!product) return res.status(404).send('Product not found');

        // Check if a user is logged in and fetch their data
        const currentUser = req.session.userId ? await User.findById(req.session.userId) : null;

        // Retrieve any message set in the session (e.g., "Item added to cart successfully!")
        const message = req.session.message || null;
        delete req.session.message; // Clear the message after retrieving it

        // Render the 'product' view with the product, user, and message data
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

// GET /cart - Display cart page
router.get('/cart', ensureLoggedIn, (req, res) => {
    const cart = req.session.cart || {};
    let totalPrice = 0;
    const products = [];

    // Convert cart object to an array of products for rendering
    for (const productId in cart) {
        const item = cart[productId];
        products.push({ id: productId, ...item });
        totalPrice += item.price * item.quantity;
    }

    res.render('cart', { products, totalPrice });
});


// POST /checkout - Checkout and pay with Stripe
router.post('/checkout', ensureLoggedIn, async (req, res) => {
    try {
        if (!req.session.cart || Object.keys(req.session.cart).length === 0) {
            return res.redirect('/cart');
        }

        const productIds = Object.keys(req.session.cart);
        const products = await Product.find({ _id: { $in: productIds } });

        if (products.length === 0) return res.redirect('/cart');

        const lineItems = products.map(product => {
            const productId = product._id.toString();
            const quantity = req.session.cart[productId].quantity;

            return {
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: product.name,
                    },
                    unit_amount: product.price * 100,
                },
                quantity: quantity,
            };
        });

        const session = await stripeClient.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: lineItems,
            mode: 'payment',
            success_url: 'http://localhost:3000/payment/success',
            cancel_url: 'http://localhost:3000/payment/cancel',
        });

        res.redirect(303, session.url);
    } catch (error) {
        console.error("Error processing payment:", error);  // More details will be logged here
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

// POST /products/:id/add-to-cart - Add item to cart
router.post('/products/:id/add-to-cart', ensureLoggedIn, async (req, res) => {
    try {
        if (!req.session.cart) req.session.cart = {};  // Initialize cart as an object

        const productId = req.params.id;

        if (req.session.cart[productId]) {
            req.session.cart[productId].quantity += 1;
        } else {
            const product = await Product.findById(productId);

            if (!product) return res.status(404).send('Product not found');
            if (typeof product.price !== 'number') return res.status(500).send('Invalid product price');  // Make sure price is valid

            req.session.cart[productId] = {   
                name: product.name,
                price: product.price,  // Save the price as a number
                quantity: 1
            };
        }

        res.redirect('/cart');
    } catch (error) {
        console.error("Error adding product to cart:", error);
        res.status(500).send('Server error.');
    }
});



// Increase Quantity
router.post('/cart/:id/increase', ensureLoggedIn, (req, res) => {
    const productId = req.params.id;

    if (req.session.cart && req.session.cart[productId]) {
        req.session.cart[productId].quantity += 1;
    }

    const totalPrice = calculateTotalPrice(req.session.cart);
    res.json({ quantity: req.session.cart[productId].quantity, totalPrice });
});

// Decrease Quantity
router.post('/cart/:id/decrease', ensureLoggedIn, (req, res) => {
    const productId = req.params.id;

    if (req.session.cart && req.session.cart[productId]) {
        if (req.session.cart[productId].quantity > 1) {
            req.session.cart[productId].quantity -= 1;
        } else {
            delete req.session.cart[productId];
        }
    }

    const totalPrice = calculateTotalPrice(req.session.cart);
    res.json({ quantity: req.session.cart[productId]?.quantity || 0, totalPrice });
});

// Remove Item from Cart
router.post('/cart/:id/remove', ensureLoggedIn, (req, res) => {
    const productId = req.params.id;

    if (req.session.cart && req.session.cart[productId]) {
        delete req.session.cart[productId];
    }

    const totalPrice = calculateTotalPrice(req.session.cart);
    res.json({ quantity: 0, totalPrice });
});

// Helper function to calculate the total price
function calculateTotalPrice(cart) {
    let totalPrice = 0;
    for (const productId in cart) {
        const item = cart[productId];
        if (item && typeof item.price === 'number' && item.quantity) {
            totalPrice += item.price * item.quantity;
        }
    }
    return totalPrice.toFixed(2);  // Return as a string formatted to 2 decimal places
}


// Clear Cart
router.post('/cart/clear', ensureLoggedIn, (req, res) => {
    req.session.cart = {};  // Clear the entire cart
    res.redirect('/cart');
});


export default router;


