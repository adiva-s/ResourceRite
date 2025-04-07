// products.mjs 

// import statements
import express from 'express';
import User from '../models/User.mjs';
import Product from '../models/Product.mjs';
import ensureLoggedIn from '../middleware/auth.mjs';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

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


//  Show individual product details
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
    let subtotal = 0;
    const products = [];

    // Convert cart object to an array of products for rendering
    for (const productId in cart) {
        const item = cart[productId];
        products.push({ id: productId, ...item });
        subtotal += item.price * item.quantity;
    }

    const rawTax = subtotal * 0.07;
    const rawTotal = subtotal + rawTax;

    res.render('cart', {
        products,
        subtotal: subtotal.toFixed(2),
        tax: rawTax.toFixed(2),
        totalPrice: rawTotal.toFixed(2)
    });
});


// POST /checkout - Checkout and pay with Stripe
// POST /checkout - Checkout and pay with Stripe
router.post('/checkout', ensureLoggedIn, async (req, res) => {
    try {
        if (!req.session.cart || Object.keys(req.session.cart).length === 0) {
            return res.redirect('/cart');
        }

        const productIds = Object.keys(req.session.cart);
        const products = await Product.find({ _id: { $in: productIds } });

        if (products.length === 0) return res.redirect('/cart');

        // Calculate subtotal
        const subtotal = products.reduce((sum, product) => {
            const quantity = req.session.cart[product._id.toString()].quantity;
            return sum + (product.price * quantity);
        }, 0);

        const tax = parseFloat((subtotal * 0.07).toFixed(2)); // 7% tax

        // Create line items for Stripe
        const lineItems = products.map(product => {
            const productId = product._id.toString();
            const quantity = req.session.cart[productId].quantity;

            return {
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: product.name,
                    },
                    unit_amount: Math.round(product.price * 100), // cents
                },
                quantity: quantity,
            };
        });

        // Add tax as a separate item
        lineItems.push({
            price_data: {
                currency: 'usd',
                product_data: {
                    name: 'Tax (7%)',
                },
                unit_amount: Math.round(tax * 100), // cents
            },
            quantity: 1,
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
        console.error("Error processing payment:", error);
        res.status(500).send('Error processing payment.');
    }
});



// GET /payment/success - Payment success page
router.get('/payment/success', async (req, res) => {
    try {
        const cart = req.session.cart || {};
        const user = await User.findById(req.session.userId);

        if (!user) {
            console.log("❌ No user found");
            return res.redirect('/');
        }

        for (const productId in cart) {
            user.purchases.push({
                productId: new mongoose.Types.ObjectId(productId),
                quantity: cart[productId].quantity,
                date: new Date()
            });
        }        

        await user.save();
        req.session.cart = {};

        console.log("✅ Purchase saved.");
        res.render('paymentSuccess');
    } catch (error) {
        console.error("⚠️ Error saving transaction:", error);
        if (!res.headersSent) {
            res.status(500).send("Something went wrong saving your purchase.");
        }
    }
});


// GET /payment/cancel - Payment cancel page
router.get('/payment/cancel', (req, res) => {
    res.render('paymentCancel'); // Renders views/paymentCancel.hbs
});



router.post('/products/:id/add-to-cart', ensureLoggedIn, async (req, res) => {
    try {
        if (!req.session.cart) req.session.cart = {};

        const productId = req.params.id;
        const product = await Product.findById(productId);

        if (!product) return res.status(404).send('Product not found');

        if (req.session.cart[productId]) {
            req.session.cart[productId].quantity += 1;
        } else {
            req.session.cart[productId] = {
                name: product.name,
                price: product.price,
                quantity: 1
            };
        }

        //  This is the magic that saves it before redirect
        req.session.save(err => {
            if (err) console.error("Session save error:", err);
            res.redirect('/cart');
        });

    } catch (error) {
        console.error("Error adding to cart:", error);
        res.status(500).send('Error adding to cart.');
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

// GET / profile
router.get('/profile', ensureLoggedIn, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId)
            .populate('wishlist')
            .populate('savedItems')
            .populate('purchases.productId');

        console.log("👉 Purchase History on profile load:", user.purchases);

        res.render('profile', {
            user: {
                username: user.username,
                wishlist: user.wishlist,
                savedItems: user.savedItems,
                purchaseHistory: user.purchases.map(p => ({
                    _id: p.productId._id,
                    name: p.productId.name,
                    price: p.productId.price,
                    date: p.date.toLocaleDateString(),
                    quantity: p.quantity
                }))
            }
        });
    } catch (error) {
        console.error("Error loading profile:", error);
        res.status(500).send("Unable to load profile.");
    }
});


export default router;


