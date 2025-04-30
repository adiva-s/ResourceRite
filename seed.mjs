import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import User from './models/User.mjs';
import Product from './models/Product.mjs';

async function seed() {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/resource_rite');

    await User.deleteMany({});
    await Product.deleteMany({});

    const passwordHash = bcrypt.hashSync('password123', 10);

    // create users
    const alice = await User.create({ username: 'alice', email: 'alice@example.com', password: passwordHash, role: 'Student', isAdmin: 0 });
    const bob = await User.create({ username: 'bob', email: 'bob@example.com', password: passwordHash, role: 'Educator', isAdmin: 0 });
    const admin = await User.create({ username: 'admin', email: 'admin@example.com', password: passwordHash, role: 'Admin', isAdmin: 1 });

    // create products
    const products = [
        { name: 'Calculus Textbook', description: 'Calculus textbook in good condition', price: 30, imageUrl: 'https://via.placeholder.com/150', category: 'Books', seller: alice._id, isActive: true},
        { name: 'Graphing Calculator', description: 'TI-84 Graphing Calculator', price: 50, imageUrl: 'https://via.placeholder.com/150', category: 'Electronics', seller: bob._id, isActive: true},
        { name: 'Physics Textbook', description: 'Physics textbook, slightly worn', price: 20, imageUrl: 'https://via.placeholder.com/150', category: 'Books', seller: alice._id, isActive: true},
        { name: 'Mac Laptop Charger', description: 'Charger compatible with Mac laptops', price: 25, imageUrl: 'https://via.placeholder.com/150', category: 'Electronics', seller: bob._id, isActive: true},
        { name: 'Microbiology Notes', description: 'Comprehensive notes for college-level microbiology', price: 10, imageUrl: 'https://via.placeholder.com/150', category: 'Notes', seller: alice._id, isActive: true},
        { name: 'Programming Handbook', description: 'Handbook for learning JavaScript', price: 18, imageUrl: 'https://via.placeholder.com/150', category: 'Books', seller: bob._id, isActive: true},
        { name: 'Digital Notes - Machine Learning', description: 'PDF notes on machine learning basics', price: 12, imageUrl: 'https://via.placeholder.com/150', category: 'Notes', seller: bob._id, isActive: true}
    ];

    await Product.insertMany(products);

    console.log("✅ Database seeded successfully");
    mongoose.disconnect();
}

seed().catch(err => console.error(err));
