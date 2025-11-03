import mongoose from 'mongoose';

/**
 * Schema for storing final aggregated analysis results
 * This will contain all results for a batch after all jobs complete
 */
const analysisResultSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  batchId: {
    type: String,
    required: true,
    unique: true,
    index: true,
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
  totalPrompts: {
    type: Number,
    required: true,
  },
  totalAiModels: {
    type: Number,
    required: true,
  },
  totalJobs: {
    type: Number,
    required: true,
  },
  completedJobs: {
    type: Number,
    default: 0,
  },
  failedJobs: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'partial_completed', 'failed'],
    default: 'pending',
    index: true,
  },
  progress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  results: [{
    prompt: {
      text: String,
      category: String,
    },
    aiModel: {
      type: String,
      enum: ['chatgpt', 'perplexity', 'google_ai_overview'],
    },
    response: mongoose.Schema.Types.Mixed,
    completedAt: Date,
  }],
  summary: {
    totalMentions: {
      type: Number,
      default: 0,
    },
    mentionsByModel: {
      chatgpt: { type: Number, default: 0 },
      perplexity: { type: Number, default: 0 },
      google_ai_overview: { type: Number, default: 0 },
    },
    rankingData: mongoose.Schema.Types.Mixed, // Can be customized based on n8n response structure
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

// Index for efficient querying
analysisResultSchema.index({ user: 1, status: 1 });
analysisResultSchema.index({ user: 1, createdAt: -1 });

// Update timestamp on save
analysisResultSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Calculate progress
  if (this.totalJobs > 0) {
    this.progress = Math.round((this.completedJobs / this.totalJobs) * 100);
  }
  
  next();
});

const AnalysisResult = mongoose.model('AnalysisResult', analysisResultSchema);

export default AnalysisResult;
