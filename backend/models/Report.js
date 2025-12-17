import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    brandId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Brand',
    },
    // Brand info
    brandName: {
      type: String,
      required: true,
    },
    brandUrl: {
      type: String,
      required: true,
    },
    favicon: {
      type: String,
    },
    // Search parameters
    searchScope: {
      type: String,
      enum: ['local', 'national'],
      required: true,
    },
    location: {
      type: String,
    },
    country: {
      type: String,
      required: true,
    },
    language: {
      type: String,
      default: 'English',
    },
    // Platforms analyzed
    platforms: {
      chatgpt: { type: Boolean, default: false },
      perplexity: { type: Boolean, default: false },
      googleAiOverviews: { type: Boolean, default: false },
    },
    // Clubbed response data (ready for rendering)
    reportData: {
      type: [mongoose.Schema.Types.Mixed], // Array of clubbed responses
      required: true,
    },
    // Statistics (calculated at generation time)
    stats: {
      totalPrompts: { type: Number, default: 0 },
      websiteFound: { type: Number, default: 0 },
      brandMentioned: { type: Number, default: 0 },
      totalFindings: { type: Number, default: 0 },
      successRate: { type: Number, default: 0 },
    },
    // Competitor comparison snapshot from n8n
    competitorComparison: {
      competitors: [
        {
          name: { type: String },
          website: { type: String },
        },
      ],
      response: {
        type: mongoose.Schema.Types.Mixed,
      },
      updatedAt: {
        type: Date,
      },
    },
    // Report metadata
    reportDate: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['in-progress', 'completed', 'failed'],
      default: 'completed',
    },
    // Progress tracking for in-progress reports
    progress: {
      currentStep: { type: Number, default: 1 }, // 1, 2, or 3
      formData: { type: mongoose.Schema.Types.Mixed }, // Saved form data
      step2Data: { type: mongoose.Schema.Types.Mixed }, // Saved step 2 data
      lastUpdated: { type: Date, default: Date.now },
    },
    isShared: {
      type: Boolean,
      default: false,
    },
    shareToken: {
      type: String,
      unique: true,
      sparse: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for faster queries
reportSchema.index({ userId: 1, createdAt: -1 });
reportSchema.index({ brandId: 1 });
// shareToken already has unique index from schema definition

const Report = mongoose.model('Report', reportSchema);

export default Report;
