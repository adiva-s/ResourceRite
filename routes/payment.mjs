import mongoose from 'mongoose'; 
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

        const subtotal = products.reduce((total, product) => total + product.price, 0);
        const tax = +(subtotal * 0.06).toFixed(2); // 6% tax
        const finalTotal = +(subtotal + tax).toFixed(2);


        res.render('checkout', { products, subtotal, tax, finalTotal });
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

// Payment success route
router.get('/success', ensureLoggedIn, async (req, res) => {
    try {
        const cart = req.session.cart || {};
        const user = await User.findById(req.session.userId);

        if (!user) {
            console.log("❌ No user found");
            return res.redirect('/');
        }

        // In your payment success route, ensure you include a delivery status
        for (const productId in cart) {
            user.purchases.push({
            productId: new mongoose.Types.ObjectId(productId),
            quantity: cart[productId].quantity,
            date: new Date(),
            deliveryStatus: "Pending"  // Or any other status you want to set
    });
}


        await user.save();
        req.session.cart = {}; // Clear cart after saving
        console.log("✅ Purchase saved.");
        res.render('paymentSuccess'); // <- Make sure this view exists
    } catch (error) {
        console.error("⚠️ Error saving transaction:", error);
        if (!res.headersSent) {
            res.status(500).send("Something went wrong saving your purchase.");
        }
    }
});


// Cancelled payment page
router.get('/cancel', (req, res) => {
    res.send('Payment was cancelled.');
});

router.get('/profile', ensureLoggedIn, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId)
            .populate('wishlist')
            .populate('savedItems')
            .populate('purchases.productId');

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
