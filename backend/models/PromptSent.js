import mongoose from 'mongoose';

const promptSentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reportId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Report',
    },
    // n8n webhook payload
    prompt: {
      type: String,
      required: true,
    },
    brand: {
      type: String,
      required: true,
    },
    brandUrl: {
      type: String,
      required: true,
    },
    chatgpt: {
      type: Boolean,
      default: false,
    },
    perplexity: {
      type: Boolean,
      default: false,
    },
    google_ai_overviews: {
      type: Boolean,
      default: false,
    },
    location: {
      type: String,
      default: null,
    },
    country: {
      type: String,
      required: true,
    },
    category: {
      type: String,
    },
    promptIndex: {
      type: Number,
    },
    // Metadata
    sentAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['pending', 'sent', 'completed', 'failed'],
      default: 'sent',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for faster queries
promptSentSchema.index({ userId: 1, createdAt: -1 });
promptSentSchema.index({ reportId: 1 });
promptSentSchema.index({ reportId: 1, promptIndex: 1 });

const PromptSent = mongoose.model('PromptSent', promptSentSchema);

export default PromptSent;
