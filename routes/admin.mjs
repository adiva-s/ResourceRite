import express from 'express';
import ensureLoggedIn from '../middleware/auth.mjs';
import ensureAdmin from '../middleware/adminAuth.mjs';
import Report from '../models/Report.mjs';
import Product from '../models/Product.mjs';

const router = express.Router();

// List open and resolved reports
router.get('/admin/reports', ensureLoggedIn, ensureAdmin, async (req, res) => {
      const openReports = await Report.find({ status: 'open' })
        .populate('reporter', 'username email')
        .populate('product', 'name');
  
      let resolved = await Report.find({ status: 'resolved' })
        .populate('reporter', 'username email')
        .populate('product', 'name isActive');
  
      // only keep those where the product is still inactive
      const closedReports = resolved.filter(r => r.product.isActive === false);
  
      res.render('admin/reports', { openReports, closedReports });
    }
  );

// GET /admin/reports/:id — display the single report detail
router.get('/admin/reports/:id', ensureLoggedIn, ensureAdmin, async (req, res) => {
      const report = await Report.findById(req.params.id)
        .populate('reporter', 'username email')
        .populate('product');
      if (!report) {
        return res.status(404).send('Report not found');
      }
      res.render('admin/reportDetail', { report });
    }
);

// POST /admin/reports/:id/resolve
router.post('/admin/reports/:id/resolve', ensureLoggedIn, ensureAdmin, async (req, res) => {
      const { action, adminComment } = req.body;
      const report = await Report.findById(req.params.id);
      if (!report) return res.status(404).send('Report not found');
  
      // remove = hide from everyone
      if (action === 'remove') {
        await Product.findByIdAndUpdate(report.product, { isActive: false });
      }
      // unhide = bring it back
      else if (action === 'unhide') {
        await Product.findByIdAndUpdate(report.product, { isActive: true });
      }
  
      // in either case, mark the report resolved
      report.status = 'resolved';
      report.adminComment = adminComment;
      report.resolvedAt = new Date();
      report.resolvedBy = req.session.userId;
      await report.save();
  
      return res.redirect('/admin/reports');
    }
  );

  // GET /admin/products/new - show add product form
  router.get('/admin/products/new', ensureLoggedIn, ensureAdmin, (req, res) => {
    res.render('admin/addProduct');  // this renders views/admin/addProduct.hbs
  });


  // POST /admin/products/new
  router.post('/admin/products/new', ensureLoggedIn, ensureAdmin, async (req, res) => {
    const { name, description, price, stock } = req.body;
    const priceCap = 50;  // set your price cap here!

    if (price > priceCap) {
        return res.render('admin/addProduct', { message: `❗ Price cannot exceed $${priceCap}.` });
    }

    try {
        await Product.create({ name, description, price, stock, isActive: true });
        res.redirect('/admin/products');  // or wherever you want to go after adding
    } catch (err) {
        console.error(err);
        res.render('admin/addProduct', { message: '❗ Error adding product.' });
    }
  });


export default router;