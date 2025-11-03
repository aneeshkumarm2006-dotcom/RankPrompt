import mongoose from 'mongoose';

const brandSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    brandName: {
      type: String,
      required: true,
    },
    websiteUrl: {
      type: String,
      required: true,
    },
    favicon: {
      type: String, // URL to favicon
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for faster queries
brandSchema.index({ userId: 1, brandName: 1 });

const Brand = mongoose.model('Brand', brandSchema);

export default Brand;
