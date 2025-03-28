// routes/profile.mjs

import express from 'express';
import ensureLoggedIn from '../middleware/auth.mjs';
import User from '../models/User.mjs';

const router = express.Router();

// GET /user/profile - display logged-in user's profile
router.get('/profile', ensureLoggedIn, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId)
            .populate('wishlist')
            .populate('savedItems')
            .populate('purchaseHistory');

        if (!user) return res.redirect('/auth/login');

        res.render('profile', { user });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error loading profile.');
    }
});

// Remove item from Wishlist
router.post('/wishlist/:productId/remove', ensureLoggedIn, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        
        user.wishlist = user.wishlist.filter(itemId => itemId.toString() !== req.params.productId);
        await user.save();

        req.session.message = "Item successfully removed from your Wishlist.";
        res.redirect('/user/profile');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error removing item from Wishlist.');
    }
});

// Remove item from Saved Items
router.post('/savedItems/:productId/remove', ensureLoggedIn, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);

        user.savedItems = user.savedItems.filter(itemId => itemId.toString() !== req.params.productId);
        await user.save();

        req.session.message = "Item successfully removed from your Saved Items.";
        res.redirect('/user/profile');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error removing item from Saved Items.');
    }
});



export default router;
