import mongoose from 'mongoose';

const promptResponseSchema = new mongoose.Schema(
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
    promptSentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PromptSent',
    },
    // Original n8n response (before clubbing)
    prompt: {
      type: String,
      required: true,
    },
    category: {
      type: String,
    },
    success: {
      type: Boolean,
      required: true,
    },
    promptIndex: {
      type: Number,
    },
    status: {
      type: Number,
    },
    response: {
      type: mongoose.Schema.Types.Mixed, // Array of platform responses
    },
    error: {
      type: String,
    },
    receivedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for faster queries
promptResponseSchema.index({ userId: 1, createdAt: -1 });
promptResponseSchema.index({ reportId: 1 });
promptResponseSchema.index({ promptSentId: 1 });
promptResponseSchema.index({ reportId: 1, promptIndex: 1 });

const PromptResponse = mongoose.model('PromptResponse', promptResponseSchema);

export default PromptResponse;
