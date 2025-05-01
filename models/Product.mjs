import mongoose from 'mongoose';
const { Schema } = mongoose;

const reviewSchema = new Schema({
    user:   { type: Schema.Types.ObjectId, ref: 'User', required: true},
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: String,
    date:   { type: Date, default: Date.now }
}, { timestamps: true }); // adds review.createdAt and review.updatedAt

const productSchema = new Schema({
    seller: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    name: { type: String, required: true },
    description: String,
    price: { type: Number, required: true, min: 0 },
    stock: { type: Number,  required: true, min: 0 },
    imageUrl: String,
    category: String,
    reviews: [reviewSchema],
    isActive: { type: Boolean, default: true }
}, {timestamps: true});

productSchema.index({ name: 'text', description: 'text' });

export default mongoose.model('Product', productSchema);