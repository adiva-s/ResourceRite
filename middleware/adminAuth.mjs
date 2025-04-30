import User from '../models/User.mjs';

export default async function ensureAdmin(req, res, next) {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  const user = await User.findById(req.session.userId);
  if (!user || !user.isAdmin) {
    return res.status(403).send('Access denied.');
  }
  next();
}