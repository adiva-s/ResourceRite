// products.mjs 

// import statements
import express from 'express';
import User from '../models/User.mjs';
import Product from '../models/Product.mjs';
import ensureLoggedIn from '../middleware/auth.mjs';
import Report from '../models/Report.mjs';
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
/* REAL
router.get('/', async (req, res) => {
    try {
      const filter = { isActive: true };
      if (req.session.userId) {
        const reportedIds = await Report
          .find({ reporter: req.session.userId, status: 'open' })
          .distinct('product');
        filter._id = { $nin: reportedIds };
      }
      const products = await Product.find(filter).lean();
      res.render('index', { products });
    } catch (err) {
      console.error(err);
      res.status(500).send('Server error.');
    }
  });
  */

// TEST
// GET / - Home page showing product listings and filters
router.get('/', async (req, res) => {
    try {
      const { category, minPrice, maxPrice, keyword } = req.query;
  
      const filter = { isActive: true };
  
      if (req.session.userId) {
        const reportedIds = await Report
          .find({ reporter: req.session.userId, status: 'open' })
          .distinct('product');
        filter._id = { $nin: reportedIds };
      }
  
      // Apply category filter
      if (category && category !== 'All') {
        filter.category = category;
      }
  
      // Apply price filter
      if (minPrice || maxPrice) {
        filter.price = {};
        if (minPrice) filter.price.$gte = parseFloat(minPrice);
        if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
      }
  
      // Apply keyword filter
      if (keyword) {
        filter.name = { $regex: keyword, $options: 'i' };
      }
  
      const products = await Product.find(filter).lean();
      res.render('index', { products });
    } catch (err) {
      console.error(err);
      res.status(500).send('Server error.');
    }
});
  



//  Show individual product details
router.get('/products/:id', async (req, res) => {
    try {
        // Find the product and populate the 'seller' field (if it exists in your model)
        const product = await Product
            .findById(req.params.id)
            .populate('seller')
            .populate({ path: 'reviews.user', select: 'username' })
            .exec();

        if (!product) return res.status(404).send('Product not found');

        // Check if a user is logged in and fetch their data
        const currentUser = req.session.userId ? await User.findById(req.session.userId) : null;

        // Retrieve any message set in the session (e.g., "Item added to cart successfully!")
        const message = req.session.message || null;
        delete req.session.message; // Clear the message after retrieving it

        // Render the 'product' view with the product, user, and message data
        res.render('product', { product, currentUser, message, ratings: [1,2,3,4,5] });
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
    const { subtotal, tax, totalPrice } = calculateTotalBreakdown(cart);    
    
    const products = [];

    for (const productId in cart) {
        const item = cart[productId];
        products.push({ id: productId, ...item });
    }

    res.render('cart', { products, subtotal, tax, totalPrice });
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

        // Calculate subtotal and tax
        const { subtotal, tax } = calculateTotalBreakdown(req.session.cart);

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
router.post('/cart/:id/increase', ensureLoggedIn, async (req, res) => {
    const productId = req.params.id;

    if (req.session.cart && req.session.cart[productId]) {
        // Find the product in the database to check the stock
        const product = await Product.findById(productId);

        if (!product) {
            return res.status(404).send('Product not found');
        }

        // Check if there's enough stock
        const currentQuantity = req.session.cart[productId].quantity;
        if (currentQuantity < product.stock) {
            req.session.cart[productId].quantity += 1;
        } else {
            return res.status(400).send('Cannot increase quantity. Not enough stock.');
        }
    }

    const { subtotal, tax, totalPrice } = calculateTotalBreakdown(req.session.cart);
    res.json({ quantity: req.session.cart[productId].quantity, subtotal, tax, totalPrice });
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

    const { subtotal, tax, totalPrice } = calculateTotalBreakdown(req.session.cart);
    res.json({ quantity: req.session.cart[productId]?.quantity || 0, subtotal, tax, totalPrice });
});


// Remove Item from Cart
router.post('/cart/:id/remove', ensureLoggedIn, (req, res) => {
    const productId = req.params.id;

    if (req.session.cart && req.session.cart[productId]) {
        delete req.session.cart[productId];
    }

    /* REAL
    const totalPrice = calculateTotalPrice(req.session.cart);
    res.json({ quantity: 0, totalPrice });
    */

    // TEST inc/dec quant
    const { subtotal, tax, totalPrice } = calculateTotalBreakdown(req.session.cart);
    res.json({ quantity: req.session.cart[productId]?.quantity || 0, subtotal, tax, totalPrice });
});

// Helper function to calculate the total price
/* REAL
function calculateTotalPrice(cart) {
    let totalPrice = 0;
    for (const productId in cart) {
        const item = cart[productId];
        if (item && typeof item.price === 'number' && typeof item.quantity === 'number' && item.quantity > 0) {
            totalPrice += item.price * item.quantity;
        }
    }
    return totalPrice.toFixed(2);  // Return as a string formatted to 2 decimal places
}
*/

// TEST calc total price for inc/dec quant
// Helper function to calculate the total price
function calculateTotalBreakdown(cart) {
    let subtotal = 0;
    for (const productId in cart) {
        const item = cart[productId];
        if (item && typeof item.price === 'number' && typeof item.quantity === 'number' && item.quantity > 0) {
            subtotal += item.price * item.quantity;
        }
    }

    const tax = parseFloat((subtotal * 0.07).toFixed(2));
    const totalPrice = parseFloat((subtotal + tax).toFixed(2));

    return {
        subtotal: subtotal.toFixed(2),
        tax: tax.toFixed(2),
        totalPrice: totalPrice.toFixed(2)
    };
}



// Clear Cart
router.post('/cart/clear', ensureLoggedIn, (req, res) => {
    req.session.cart = {};  // Clear the entire cart
    res.redirect('/cart');
});

router.post('/products/:id/review', ensureLoggedIn, async (req, res) => {
    const { rating, comment } = req.body;
    const product = await Product.findById(req.params.id);
    product.reviews.push({
        user: req.session.userId,
        rating: Number(rating),
        comment
    });
    await product.save();
    res.redirect(`/products/${req.params.id}`);
});
  

router.post('/products/:id/report', ensureLoggedIn, async (req, res) => {
    const { reason } = req.body;
    const existing = await Report.findOne({
        reporter: req.session.userId,
        product: req.params.id,
        status: 'open'
    });
    if (!existing) {
        await Report.create({
            reporter: req.session.userId,
            product: req.params.id,
            reason
            });
    }
    // send them to home, and they’ll no longer see that listing
    res.redirect('/');
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


