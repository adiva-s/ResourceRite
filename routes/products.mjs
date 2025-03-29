// products.mjs 

// Import statements
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

// GET /products/:id - View individual product
router.get('/products/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).send('Product not found.');
        res.render('product', { product });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error loading product.');
    }
});

// POST /products/:id/add-to-cart - Add product to cart
router.post('/products/:id/add-to-cart', ensureLoggedIn, async (req, res) => {
    try {
        const productId = req.params.id;
        const product = await Product.findById(productId);

        if (!product) return res.status(404).send('Product not found.');

        if (req.session.cart[productId]) {
            req.session.cart[productId].quantity += 1;
        } else {
            req.session.cart[productId] = { 
                name: product.name, 
                price: product.price, 
                quantity: 1 
            };
        }

        res.redirect('/cart');
    } catch (error) {
        console.error("Error adding product to cart:", error);
        res.status(500).send('Error adding to cart.');
    }
});

// GET /cart - View Cart
router.get('/cart', ensureLoggedIn, (req, res) => {
    const cart = req.session.cart;
    let totalPrice = 0;
    const products = [];

    for (const productId in cart) {
        const item = cart[productId];
        totalPrice += item.price * item.quantity;
        products.push({ id: productId, ...item });
    }

    res.render('cart', { products, totalPrice });
});

// POST /checkout - Checkout and create Stripe session
router.post('/checkout', ensureLoggedIn, async (req, res) => {
    try {
        const cart = req.session.cart;
        if (!cart || Object.keys(cart).length === 0) return res.redirect('/cart');

        const lineItems = Object.values(cart).map(item => ({
            price_data: {
                currency: 'usd',
                product_data: { name: item.name },
                unit_amount: item.price * 100,
            },
            quantity: item.quantity,
        }));

        const session = await stripeClient.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: lineItems,
            mode: 'payment',
            success_url: 'http://localhost:3000/payment/success',
            cancel_url: 'http://localhost:3000/payment/cancel',
        });

        req.session.cart = {};  // Clear cart after successful payment
        res.redirect(303, session.url);
    } catch (error) {
        console.error("Error processing payment:", error);
        res.status(500).send('Error processing payment.');
    }
});

// Increase Quantity
router.post('/cart/:id/increase', ensureLoggedIn, (req, res) => {
    const productId = req.params.id;
    const cart = req.session.cart;

    if (cart[productId]) {
        cart[productId].quantity += 1;
    }

    const totalPrice = Object.values(cart).reduce((sum, item) => sum + (item.price * item.quantity), 0);
    res.json({ quantity: cart[productId].quantity, totalPrice });
});

// Decrease Quantity
router.post('/cart/:id/decrease', ensureLoggedIn, (req, res) => {
    const productId = req.params.id;
    const cart = req.session.cart;

    if (cart[productId]) {
        if (cart[productId].quantity > 1) {
            cart[productId].quantity -= 1;
        } else {
            delete cart[productId];
        }
    }

    const totalPrice = Object.values(cart).reduce((sum, item) => sum + (item.price * item.quantity), 0);
    res.json({ quantity: cart[productId] ? cart[productId].quantity : 0, totalPrice });
});

// Remove Item from Cart
router.post('/cart/:id/remove', ensureLoggedIn, (req, res) => {
    const productId = req.params.id;
    const cart = req.session.cart;

    if (cart[productId]) delete cart[productId];

    const totalPrice = Object.values(cart).reduce((sum, item) => sum + (item.price * item.quantity), 0);
    res.json({ quantity: 0, totalPrice });
});


export default router;
