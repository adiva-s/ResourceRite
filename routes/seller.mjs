import express from 'express';
import Product from '../models/Product.mjs';
import ensureLoggedIn, { ensureSellerOwns } from '../middleware/auth.mjs';

const router = express.Router();

// 3.1 List this user’s products
router.get('/seller/products', ensureLoggedIn, async (req, res) => {
  const products = await Product.find({ seller: req.session.userId });
  res.render('seller_products', { products });
});

// 3.2 Show form to create a new product
router.get('/seller/products/new', ensureLoggedIn, (req, res) => {
  res.render('product_form', { product: {}, action: '/seller/products', method: 'POST' });
});

// 3.3 Handle creation
router.post('/seller/products', ensureLoggedIn, async (req, res) => {
  const { name, description, category, price, imageUrl } = req.body;
  await Product.create({
    name,
    description,
    category,
    price,
    imageUrl,
    seller: req.session.userId
  });
  req.session.message = 'Product created';
  res.redirect('/seller/products');
});

// 3.4 Show form to edit an existing product
router.get(
  '/seller/products/:id/edit',
  ensureLoggedIn,
  ensureSellerOwns,
  async (req, res) => {
    const product = await Product.findById(req.params.id);
    res.render('product_form', {
      product,
      action: `/seller/products/${product._id}?_method=PUT`,
      method: 'POST'    // we’ll use method-override
    });
  }
);

// 3.5 Handle update
router.put(
  '/seller/products/:id',
  ensureLoggedIn,
  ensureSellerOwns,
  async (req, res) => {
    const { name, description, category, price, imageUrl } = req.body;
    await Product.findByIdAndUpdate(req.params.id, {
      name,
      description,
      category,
      price,
      imageUrl,
      updatedAt: Date.now()
    });
    req.session.message = 'Product updated';
    res.redirect('/seller/products');
  }
);

// 3.6 Handle delete
router.delete(
  '/seller/products/:id',
  ensureLoggedIn,
  ensureSellerOwns,
  async (req, res) => {
    await Product.findByIdAndDelete(req.params.id);
    req.session.message = 'Product deleted';
    res.redirect('/seller/products');
  }
);

export default router;
