import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    username: { 
        type: String, 
        required: function () { return !this.googleId; }
    },
    email: { 
        type: String,
        required: function () { return !this.googleId; }, // Only required if NOT using Google OAuth
        unique: true  // Optional: Ensures one email per user
    },
    password: { 
        type: String, 
        required: function () { return !this.googleId; }
    },
    googleId: { type: String },
    name: { type: String },
    role: { type: String, default: 'user' },
    wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    savedItems: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    purchaseHistory: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    purchases: [
        {
            productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
            quantity: Number,
            date: { type: Date, default: Date.now },
            deliveryStatus: { type: String, default: 'Processing' } 
        }
    ]
    
});

const User = mongoose.model('User', userSchema);
export default User;
