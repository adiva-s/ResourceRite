// routes/profile.mjs

import express from 'express';
import ensureLoggedIn from '../middleware/auth.mjs';
import User from '../models/User.mjs';

const router = express.Router();

// GET /user/profile - display logged-in user's profile
router.get('/profile', ensureLoggedIn, async (req, res) => {
    try {

        console.log("Logged in user ID:", req.session.userId);

        const user = await User.findById(req.session.userId)
            .populate('wishlist')
            .populate('savedItems')
            .populate('purchases.productId');

        if (!user) return res.redirect('/auth/login');

        console.log("🛒 Purchase History on profile load:", user.purchases);

        res.render('profile', {
            user: {
              username: user.username,
              wishlist: user.wishlist,
              savedItems: user.savedItems,
              purchaseHistory: user.purchases.map(p => {
                const product = p.productId;
                return {
                  _id: product?._id || '',
                  name: product?.name || 'Unknown Product',
                  price: product?.price || 'N/A',
                  quantity: p.quantity,
                  date: p.date.toLocaleDateString(),
                  deliveryStatus: p.deliveryStatus || 'Not Available'
                };
              })
            }
        });          
    } catch (error) {
        console.error("Error loading profile:", error);
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


// POST /profile/edit - update user profile
router.post('/profile/edit', ensureLoggedIn, async (req, res) => {
    try {
        const { name, username, email } = req.body;

        const user = await User.findById(req.session.userId);
        if (!user) {
            return res.redirect('/auth/login');
        }

        user.name = name;
        // Check if the username is already taken by someone else
        const existingUsername = await User.findOne({ username, _id: { $ne: user._id } });
        if (existingUsername) {
            return res.render('profile', { user, message: "❗ Username already taken. Please choose another one." });
        }

        user.username = username;

        user.email = email;

        await user.save();

        res.redirect('/profile'); // go back to profile page after saving
    } catch (err) {
        console.error("Error updating profile:", err);
        res.status(500).send('Error updating profile.');
    }
});

// POST /profile/resetPassword - reset user's password
router.post('/profile/resetPassword', ensureLoggedIn, async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmNewPassword } = req.body;
        const user = await User.findById(req.session.userId);

        // TEST if user is returned for reset pwd
        console.log("User found:", user);
        
        if (!user) {
            return res.redirect('/auth/login');
        }

        // TEST const match for reset pwd
        const match = await bcrypt.compare(currentPassword, user.password);

        //REAL const match = bcrypt.compareSync(currentPassword, user.password);
        if (!match) {
            return res.render('profile', { user, message: "Current password is incorrect." });
        }

        if (newPassword !== confirmNewPassword) {
            return res.render('profile', { user, message: "New passwords do not match." });
        }

        // Check password strength
        const passwordRegex = /^(?=.*[0-9])(?=.*[!@#$%^&*])[A-Za-z0-9!@#$%^&*]{8,}$/;
        if (!passwordRegex.test(newPassword)) {
            return res.render('profile', { user, message: "New password must be at least 8 characters, include a number and a special character." });
        }

        // Hash and save new password
        const hashedPassword = bcrypt.hashSync(newPassword, 10);
        user.password = hashedPassword;
        
        // REAL await user.save();
        // TEST user.save for reset pwd
        try {
            await user.save();
        } catch (saveErr) {
            console.error("Save failed:", saveErr);
            return res.render('profile', { user, message: "Failed to save new password." });
        }
        

        res.render('profile', { user, message: "Password updated successfully!" });

    } catch (err) {
        console.error("Error resetting password:", err);
        res.status(500).send('Error resetting password.');
    }
});




export default router;
