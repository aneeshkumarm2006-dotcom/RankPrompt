import mongoose from 'mongoose';

/**
 * Schema for tracking individual prompt-AI model analysis requests
 * Each record represents one HTTP call to n8n
 */
const analysisJobSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  batchId: {
    type: String,
    required: true,
    index: true, // To group all jobs from the same "Analyze Brand" click
  },
  scheduledPromptId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ScheduledPrompt',
    default: null,
  },
  brandName: {
    type: String,
    required: true,
    trim: true,
  },
  brandUrl: {
    type: String,
    required: true,
    trim: true,
  },
  prompt: {
    text: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    categoryDescription: {
      type: String,
    },
  },
  aiModel: {
    type: String,
    enum: ['chatgpt', 'perplexity', 'google_ai_overview'],
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'timeout'],
    default: 'pending',
    index: true,
  },
  n8nWebhookId: {
    type: String,
    default: null, // ID returned from n8n if applicable
  },
  response: {
    type: mongoose.Schema.Types.Mixed,
    default: null, // Will store the AI response once received
  },
  error: {
    type: String,
    default: null,
  },
  retryCount: {
    type: Number,
    default: 0,
  },
  maxRetries: {
    type: Number,
    default: 3,
  },
  estimatedCompletionTime: {
    type: Date,
    default: null,
  },
  startedAt: {
    type: Date,
    default: null,
  },
  completedAt: {
    type: Date,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Compound index for tracking batch progress
analysisJobSchema.index({ batchId: 1, status: 1 });
analysisJobSchema.index({ user: 1, createdAt: -1 });

// Update timestamp on save
analysisJobSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Method to check if job can be retried
analysisJobSchema.methods.canRetry = function() {
  return this.retryCount < this.maxRetries && this.status === 'failed';
};

const AnalysisJob = mongoose.model('AnalysisJob', analysisJobSchema);

export default AnalysisJob;
