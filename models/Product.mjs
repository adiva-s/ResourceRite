import mongoose from 'mongoose';

const { Schema } = mongoose;

const reviewSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    rating: { type: Number, min: 1, max: 5 },
    comment: String,
    date: { type: Date, default: Date.now }
});

const productSchema = new Schema({
    name: { type: String, required: true },
    description: String,
    price: { type: Number, required: true },
    imageUrl: String,
    category: String,
    seller: { type: Schema.Types.ObjectId, ref: 'User' },
    reviews: [reviewSchema]
});

productSchema.index({ name: 'text', description: 'text' });

export default mongoose.model('Product', productSchema);
