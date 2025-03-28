import express from 'express';
import Product from '../models/Product.mjs';
import ensureLoggedIn from '../middleware/auth.mjs';
import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();
const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Display the checkout page
router.get('/checkout', ensureLoggedIn, async (req, res) => {
    try {
        if (!req.session.cart || req.session.cart.length === 0) {
            return res.redirect('/');  // If cart is empty, redirect to home page
        }

        const products = await Product.find({ _id: { $in: req.session.cart } });

        const totalAmount = products.reduce((total, product) => total + product.price, 0);

        res.render('checkout', { products, totalAmount });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error displaying checkout page.');
    }
});

// Handle payment
router.post('/checkout', ensureLoggedIn, async (req, res) => {
    try {
        const { totalAmount } = req.body;

        // Fetch all products in the cart from the database
        const products = await Promise.all(req.session.cart.map(productId => Product.findById(productId)));

        if (products.includes(null)) return res.status(404).send('One or more products not found.');

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: products.map(product => ({
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: product.name,  // ✅ Accessing product name properly
                    },
                    unit_amount: product.price * 100, // Stripe requires amount in cents
                },
                quantity: 1,
            })),
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


// Successful payment page
router.get('/success', (req, res) => {
    req.session.cart = []; // Clear cart upon successful payment
    res.send('Payment successful! Thank you for your purchase.');
});

// Cancelled payment page
router.get('/cancel', (req, res) => {
    res.send('Payment was cancelled.');
});

export default router;
