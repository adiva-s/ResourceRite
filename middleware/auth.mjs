// middleware/auth.mjs
import Product from '../models/Product.mjs';

export default function ensureLoggedIn(req, res, next) {
    if (req.isAuthenticated() && req.user) {  // Checks if user is authenticated via Passport
        return next();
    }
    return res.redirect('/auth/login');
}

// ensureSellerOwns: verifies current user is the product’s seller
export async function ensureSellerOwns(req, res, next) {
    const prod = await Product.findById(req.params.id).select('seller');
    if (!prod) return res.status(404).send('Product not found');
    if (prod.seller.toString() !== req.session.userId) {
      return res.status(403).send('Not authorized');
    }
    next();
}