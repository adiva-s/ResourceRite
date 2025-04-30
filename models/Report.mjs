import mongoose from 'mongoose';
const { Schema } = mongoose;

const reportSchema = new Schema({
  reporter: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  reason: { type: String, required: true },
  status: { type: String, enum: ['open', 'resolved'], default: 'open' },
  adminComment: String,
  createdAt: { type: Date, default: Date.now },
  resolvedAt: Date,
  resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' }
});

export default mongoose.model('Report', reportSchema);