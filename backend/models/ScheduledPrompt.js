import mongoose from 'mongoose';

/**
 * Schema for storing prompts that will be used for scheduled analysis
 * This table will be queried by n8n cron job every 24 hours
 */
const scheduledPromptSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  brandId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Brand',
    required: false,
    index: true,
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
  prompts: [{
    // Store full PromptSent document data
    _id: mongoose.Schema.Types.ObjectId,
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    reportId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Report',
    },
    prompt: String,
    brand: String,
    brandUrl: String,
    chatgpt: Boolean,
    perplexity: Boolean,
    google_ai_overviews: Boolean,
    location: String,
    country: String,
    category: String,
    promptIndex: Number,
    status: String,
    sentAt: Date,
    createdAt: Date,
    updatedAt: Date,
  }],
  aiModels: [{
    type: String,
    enum: ['chatgpt', 'perplexity', 'google_ai_overview'],
    required: true,
  }],
  searchScope: {
    type: String,
    enum: ['global', 'local', 'national'],
    default: 'global',
  },
  location: {
    type: String,
    default: null,
  },
  language: {
    type: String,
    default: 'English',
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  scheduleFrequency: {
    type: String,
    enum: ['daily', 'weekly', 'monthly'],
    default: 'daily',
  },
  lastRun: {
    type: Date,
    default: null,
  },
  lastReportId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Report',
    default: null,
  },
  nextRun: {
    type: Date,
    default: null,
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
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

// Index for efficient querying by n8n
scheduledPromptSchema.index({ isActive: 1, nextRun: 1 });
scheduledPromptSchema.index({ user: 1, createdAt: -1 });
scheduledPromptSchema.index({ brandId: 1, nextRun: 1 });

// Update timestamp on save
scheduledPromptSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

const ScheduledPrompt = mongoose.model('ScheduledPrompt', scheduledPromptSchema);

export default ScheduledPrompt;
