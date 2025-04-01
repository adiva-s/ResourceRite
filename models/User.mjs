import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    username: { 
        type: String, 
        required: function() { return !this.googleId; } // Required only for regular signup users
    },
    password: { 
        type: String, 
        required: function() { return !this.googleId; } // Required only for regular signup users
    },
    googleId: { type: String, required: false }, // Only for Google OAuth users
    name: { type: String, required: false },     // Display name for Google OAuth users
    role: { type: String, default: 'user' },
    wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    savedItems: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    purchaseHistory: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    purchases: [
        {
            productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
            quantity: Number,
            date: { type: Date, default: Date.now }
        }
    ]
      
      
});

const User = mongoose.model('User', userSchema);

export default User;
