import crypto from 'crypto';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import ScheduledPrompt from '../models/ScheduledPrompt.js';
import Report from '../models/Report.js';
import PromptSent from '../models/PromptSent.js';

/**
 * Update scheduled prompt details (currently supports prompts text)
 * @route PUT /api/analysis/scheduled-prompts/:id
 * @access Private
 */
export const updateScheduledPrompt = async (req, res) => {
  try {
    const { id } = req.params;
    const { prompts } = req.body;

    const scheduledPrompt = await ScheduledPrompt.findById(id);

    if (!scheduledPrompt) {
      return res.status(404).json({
        success: false,
        message: 'Scheduled report not found',
      });
    }

    // Verify ownership
    if (scheduledPrompt.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to edit this scheduled report',
      });
    }

    // Validate prompts
    if (!Array.isArray(prompts) || prompts.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one prompt is required',
      });
    }

    let cleanedPrompts = prompts
      .map((p, idx) => {
        const promptText = typeof p === 'string' ? p : p?.prompt;
        const trimmed = typeof promptText === 'string' ? promptText.trim() : '';
        if (!trimmed) return null;

        // Preserve any extra fields sent by client while ensuring required fields
        const base = typeof p === 'object' && p !== null ? { ...p } : {};

        return {
          ...base,
          prompt: trimmed,
          promptIndex: typeof base.promptIndex === 'number' ? base.promptIndex : idx,
          brand: base.brand || scheduledPrompt.brandName,
          brandUrl: base.brandUrl || scheduledPrompt.brandUrl,
        };
      })
      .filter(Boolean);

    if (cleanedPrompts.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Prompts cannot be empty',
      });
    }

    // Normalize promptIndex sequencing
    cleanedPrompts = cleanedPrompts.map((p, idx) => ({
      ...p,
      promptIndex: idx,
    }));

    scheduledPrompt.prompts = cleanedPrompts;
    scheduledPrompt.lastUpdated = new Date();

    await scheduledPrompt.save();

    return res.status(200).json({
      success: true,
      message: 'Scheduled prompts updated successfully',
      data: scheduledPrompt,
    });
  } catch (error) {
    console.error('Update scheduled prompt error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update scheduled prompts',
      error: error.message,
    });
  }
};

/**
 * Store prompts for scheduling after step 3 (generate-prompts)
 * This will be called when user clicks "Analyze Brand" button
 * @route POST /api/analysis/store-prompts
 * @access Private
 */
export const storePromptsForScheduling = async (req, res) => {
  try {
    const {
      brandName,
      brandUrl,
      prompts,
      aiModels,
      searchScope,
      location,
      language,
      scheduleFrequency,
    } = req.body;

    // Validation
    if (!brandName || !brandUrl || !prompts || !aiModels) {
      return res.status(400).json({
        success: false,
        message: 'Brand name, URL, prompts, and AI models are required',
      });
    }

    if (!Array.isArray(prompts) || prompts.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one prompt is required',
      });
    }

    if (!Array.isArray(aiModels) || aiModels.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one AI model must be selected',
      });
    }

    // Enforce plan-based model access
    const allowedModels = req.user?.allowedModels || ['chatgpt'];
    const isAllowed = aiModels.every((m) => allowedModels.includes(m));
    if (!isAllowed) {
      return res.status(403).json({
        success: false,
        message: 'Selected AI models are not available on your plan.',
      });
    }

    // Calculate next run time (24 hours from now)
    const nextRun = new Date();
    nextRun.setHours(nextRun.getHours() + 24);

    // Create scheduled prompt record
    const scheduledPrompt = await ScheduledPrompt.create({
      user: req.user._id,
      brandName,
      brandUrl,
      prompts,
      aiModels,
      searchScope: searchScope || 'global',
      location: location || null,
      language: language || 'English',
      scheduleFrequency: scheduleFrequency || 'daily',
      nextRun,
      isActive: true,
    });

    res.status(201).json({
      success: true,
      message: 'Prompts stored successfully for scheduling',
      data: {
        scheduledPromptId: scheduledPrompt._id,
        totalPrompts: prompts.length,
        totalAiModels: aiModels.length,
        nextRun: scheduledPrompt.nextRun,
      },
    });
  } catch (error) {
    console.error('Store prompts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to store prompts for scheduling',
      error: error.message,
    });
  }
};

/**
 * Initiate brand analysis - sends HTTP calls directly
 * @route POST /api/analysis/initiate
 * @access Private
 */
export const initiateAnalysis = async (req, res) => {
  try {
    const {
      brandName,
      brandUrl,
      prompts,
      aiModels,
    } = req.body;

    // Validation
    if (!brandName || !brandUrl || !prompts || !aiModels) {
      return res.status(400).json({
        success: false,
        message: 'Brand name, URL, prompts, and AI models are required',
      });
    }

    // Enforce plan-based model access
    const allowedModels = req.user?.allowedModels || ['chatgpt'];
    const isAllowed = aiModels.every((m) => allowedModels.includes(m));
    if (!isAllowed) {
      return res.status(403).json({
        success: false,
        message: 'Selected AI models are not available on your plan.',
      });
    }

    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
    if (!n8nWebhookUrl) {
      return res.status(500).json({
        success: false,
        message: 'N8N_WEBHOOK_URL not configured',
      });
    }

    const totalCalls = prompts.length * aiModels.length;

    // Send response immediately
    res.status(200).json({
      success: true,
      message: 'Analysis started',
      data: {
        totalCalls: totalCalls * 2,
        prompts: prompts.length,
        aiModels: aiModels.length,
      },
    });

    // Process all calls in background
    const results = [];
    let completedCalls = 0;

    for (const prompt of prompts) {
      for (const aiModel of aiModels) {
        
        try {
          const n8nResponse = await axios.get(n8nWebhookUrl, {
            params: {
              prompt: prompt.text,
              brand: brandName,
              brandUrl: brandUrl,
              aiModel: aiModel,
            },
            timeout: 60000,
          });

          results.push({
            prompt: prompt.text,
            aiModel,
            success: hasValidResponse,
            response: n8nResponse.data,
          });
        } catch (error) {
          console.log(`Error: ${error.message}`);
          results.push({
            prompt: prompt.text,
            aiModel,
            success: false,
            error: error.message,
          });
        }
      }
    }

  } catch (error) {
    console.error('Initiate analysis error:', error);
  }
};



/**
 * Get user's scheduled prompts (for n8n cron job to fetch)
 * @route GET /api/analysis/scheduled-prompts
 * @access Private (can also be accessed by n8n with API key)
 */
export const getScheduledPrompts = async (req, res) => {
  try {
    const { userId, isActive, brandId } = req.query;

    const query = {};
    
    // If userId provided, filter by user
    if (userId) {
      query.user = userId;
    } else if (req.user) {
      // If authenticated user, show their prompts
      query.user = req.user._id;
    }

    // Filter by brandId if provided
    if (brandId) {
      // Convert to ObjectId if it's a valid ObjectId string
      if (mongoose.Types.ObjectId.isValid(brandId)) {
        query.brandId = new mongoose.Types.ObjectId(brandId);
      } else {
        query.brandId = brandId;
      }
    }

    // Filter by active status
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    const scheduledPrompts = await ScheduledPrompt.find(query)
      .populate('user', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: scheduledPrompts.length,
      data: scheduledPrompts,
    });
  } catch (error) {
    console.error('Get scheduled prompts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get scheduled prompts',
      error: error.message,
    });
  }
};

/**
 * Get scheduled prompts by brand ID (alternative endpoint)
 * @route GET /api/analysis/scheduled/:brandId
 * @access Private
 */
export const getScheduledPromptsByBrand = async (req, res) => {
  try {
    const { brandId } = req.params;

    const query = {
      user: req.user._id,
      isActive: true,
    };

    // Filter by brandId
    if (mongoose.Types.ObjectId.isValid(brandId)) {
      query.brandId = new mongoose.Types.ObjectId(brandId);
    } else {
      query.brandId = brandId;
    }

    const scheduledPrompts = await ScheduledPrompt.find(query)
      .populate('user', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: scheduledPrompts.length,
      data: scheduledPrompts,
    });
  } catch (error) {
    console.error('Get scheduled prompts by brand error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get scheduled prompts',
      error: error.message,
    });
  }
};

/**
 * Get prompts due for execution (for n8n cron job)
 * @route GET /api/analysis/prompts-due
 * @access Public (protected by API key)
 */
export const getPromptsDue = async (req, res) => {
  try {
    // Verify API key for n8n
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== process.env.N8N_API_KEY) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    // Find all active scheduled prompts where nextRun is in the past
    const now = new Date();
    const duePrompts = await ScheduledPrompt.find({
      isActive: true,
      $or: [
        { nextRun: { $lte: now } },
        { nextRun: null },
      ],
    }).populate('user', 'name email');

    res.status(200).json({
      success: true,
      count: duePrompts.length,
      data: duePrompts,
    });
  } catch (error) {
    console.error('Get prompts due error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get prompts due',
      error: error.message,
    });
  }
};

/**
 * Update scheduled prompt's last run time (called by n8n after execution)
 * @route PUT /api/analysis/scheduled-prompts/:id/update-run
 * @access Public (protected by API key)
 * @body { reportDate?: Date } - Optional report date, defaults to current date
 */
export const updateScheduledPromptRun = async (req, res) => {
  try {
    // Verify API key for n8n
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== process.env.N8N_API_KEY) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const { id } = req.params;
    const { reportDate, reportId } = req.body; // Accept reportDate and reportId from body
    const scheduledPrompt = await ScheduledPrompt.findById(id);

    if (!scheduledPrompt) {
      return res.status(404).json({
        success: false,
        message: 'Scheduled prompt not found',
      });
    }

    // Use provided reportDate, or try to get it from the report, or use current date
    let lastRunDate = new Date();
    if (reportDate) {
      lastRunDate = new Date(reportDate);
    } else if (reportId) {
      const report = await Report.findById(reportId);
      if (report) {
        lastRunDate = report.reportDate || report.createdAt || new Date();
      }
    }

    // Update last run to the report's date
    scheduledPrompt.lastRun = lastRunDate;
    
    // Update lastReportId if provided
    if (reportId) {
      scheduledPrompt.lastReportId = reportId;
    }
    
    // Calculate next run based on frequency from the lastRun date
    const nextRun = new Date(lastRunDate);
    switch (scheduledPrompt.scheduleFrequency) {
      case 'daily':
        nextRun.setDate(nextRun.getDate() + 1);
        break;
      case 'weekly':
        nextRun.setDate(nextRun.getDate() + 7);
        break;
      case 'monthly':
        nextRun.setMonth(nextRun.getMonth() + 1);
        break;
      default:
        nextRun.setDate(nextRun.getDate() + 1);
    }
    
    scheduledPrompt.nextRun = nextRun;
    scheduledPrompt.lastUpdated = new Date();
    
    await scheduledPrompt.save();

    res.status(200).json({
      success: true,
      message: 'Scheduled prompt updated successfully',
      data: {
        lastRun: scheduledPrompt.lastRun,
        nextRun: scheduledPrompt.nextRun,
      },
    });
  } catch (error) {
    console.error('Update scheduled prompt run error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update scheduled prompt',
      error: error.message,
    });
  }
};

/**
 * Webhook endpoint for n8n to send back results (optional)
 * @route POST /api/analysis/webhook/result
 * @access Public (protected by API key)
 */
export const receiveN8nResult = async (req, res) => {
  try {
    // Verify API key for n8n
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== process.env.N8N_API_KEY) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const { data } = req.body;
    console.log('Received n8n result:', data);

    res.status(200).json({
      success: true,
      message: 'Result received successfully',
    });
  } catch (error) {
    console.error('Receive N8N result error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to receive result',
      error: error.message,
    });
  }
};

/**
 * Generate a signed JWT token for n8n webhook authentication
 * @route POST /api/analysis/generate-webhook-token
 * @access Private
 */
export const generateWebhookToken = async (req, res) => {
  try {
    const { userId, email } = req.user; // From protect middleware
    const webhookSecret = process.env.N8N_WEBHOOK_SECRET;

    if (!webhookSecret) {
      return res.status(500).json({
        success: false,
        message: 'Webhook secret not configured',
      });
    }

    // Generate JWT token with 5 minute expiry
    const token = jwt.sign(
      {
        userId,
        email,
        purpose: 'n8n-webhook',
        timestamp: Date.now(),
      },
      webhookSecret,
      { expiresIn: '5m' }
    );

    res.status(200).json({
      success: true,
      data: {
        token,
        expiresIn: 300, // 5 minutes in seconds
      },
    });
  } catch (error) {
    console.error('Generate webhook token error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate webhook token',
      error: error.message,
    });
  }
};

export default {
  storePromptsForScheduling,
  initiateAnalysis,
  getScheduledPrompts,
  getPromptsDue,
  updateScheduledPromptRun,
  receiveN8nResult,
  generateWebhookToken,
};

/**
 * Create a scheduled prompt from an existing report and frequency
 * @route POST /api/analysis/schedule-from-report
 * @access Private
 */
export const scheduleFromReport = async (req, res) => {
  try {
    const { reportId, frequency } = req.body;

    if (!reportId || !frequency) {
      return res.status(400).json({ success: false, message: 'reportId and frequency are required' });
    }

    if (!['daily', 'weekly', 'monthly'].includes(frequency)) {
      return res.status(400).json({ success: false, message: 'frequency must be daily, weekly or monthly' });
    }

    const report = await Report.findOne({ _id: reportId, userId: req.user._id });
    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    if (!report.brandId) {
      return res.status(400).json({ success: false, message: 'This report is not linked to a brand and cannot be scheduled' });
    }

    // Get promptsSent for this report to reconstruct prompt set
    const promptsSent = await PromptSent.find({ reportId }).sort({ promptIndex: 1 });
    if (!promptsSent.length) {
      return res.status(400).json({ success: false, message: 'No prompts found for this report' });
    }

    // Derive aiModels from report.platforms
    const aiModels = [];
    if (report.platforms?.chatgpt) aiModels.push('chatgpt');
    if (report.platforms?.perplexity) aiModels.push('perplexity');
    if (report.platforms?.googleAiOverviews) aiModels.push('google_ai_overview');

    // Store full PromptSent document data in prompts array
    const prompts = promptsSent.map(p => ({
      _id: p._id,
      userId: p.userId,
      reportId: p.reportId,
      prompt: p.prompt,
      brand: p.brand,
      brandUrl: p.brandUrl,
      chatgpt: p.chatgpt,
      perplexity: p.perplexity,
      google_ai_overviews: p.google_ai_overviews,
      location: p.location,
      country: p.country,
      category: p.category,
      promptIndex: p.promptIndex,
      status: p.status,
      sentAt: p.sentAt,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));

    // Calculate nextRun based on frequency
    const nextRun = new Date();
    switch (frequency) {
      case 'daily':
        nextRun.setDate(nextRun.getDate() + 1);
        break;
      case 'weekly':
        nextRun.setDate(nextRun.getDate() + 7);
        break;
      case 'monthly':
        nextRun.setMonth(nextRun.getMonth() + 1);
        break;
    }

    // Set lastRun to the original report's creation date
    const lastRun = report.reportDate || report.createdAt || new Date();

    const scheduledPrompt = await ScheduledPrompt.create({
      user: req.user._id,
      brandId: report.brandId,
      brandName: report.brandName,
      brandUrl: report.brandUrl,
      prompts,
      aiModels,
      searchScope: report.searchScope === 'local' ? 'local' : 'national',
      location: report.location || null,
      language: report.language || 'English',
      isActive: true,
      scheduleFrequency: frequency,
      lastReportId: report._id,
      lastRun, // Set to original report date
      nextRun,
      lastUpdated: new Date(),
    });

    return res.status(201).json({ success: true, data: scheduledPrompt });
  } catch (error) {
    console.error('scheduleFromReport error:', error);
    return res.status(500).json({ success: false, message: 'Failed to schedule from report', error: error.message });
  }
};

/**
 * Pause or resume a scheduled report
 * @route PUT /api/analysis/scheduled-prompts/:id/toggle
 * @access Private
 */
export const toggleScheduledPrompt = async (req, res) => {
  try {
    const { id } = req.params;
    const scheduledPrompt = await ScheduledPrompt.findById(id);

    if (!scheduledPrompt) {
      return res.status(404).json({
        success: false,
        message: 'Scheduled report not found',
      });
    }

    // Verify ownership
    if (scheduledPrompt.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to modify this scheduled report',
      });
    }

    // Toggle the isActive status
    scheduledPrompt.isActive = !scheduledPrompt.isActive;
    scheduledPrompt.lastUpdated = new Date();
    
    await scheduledPrompt.save();

    res.status(200).json({
      success: true,
      data: scheduledPrompt,
      message: scheduledPrompt.isActive ? 'Scheduled report resumed' : 'Scheduled report paused',
    });
  } catch (error) {
    console.error('Toggle scheduled prompt error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle scheduled report',
      error: error.message,
    });
  }
};

/**
 * Delete a scheduled report
 * @route DELETE /api/analysis/scheduled-prompts/:id
 * @access Private
 */
export const deleteScheduledPrompt = async (req, res) => {
  try {
    const { id } = req.params;
    const scheduledPrompt = await ScheduledPrompt.findById(id);

    if (!scheduledPrompt) {
      return res.status(404).json({
        success: false,
        message: 'Scheduled report not found',
      });
    }

    // Verify ownership
    if (scheduledPrompt.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this scheduled report',
      });
    }

    await ScheduledPrompt.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Scheduled report deleted successfully',
    });
  } catch (error) {
    console.error('Delete scheduled prompt error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete scheduled report',
      error: error.message,
    });
  }
};

/**
 * N8N Webhook for saving reports with $oid format conversion
 * This endpoint accepts n8n's payload where userId and brandId are in { $oid: "string" } format
 * and converts them to proper MongoDB ObjectId before saving
 * @route POST /api/analysis/n8n-save-report
 * @access Public (protected by API key)
 */
export const n8nSaveReport = async (req, res) => {
  try {
    // Verify API key for n8n
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== process.env.N8N_API_KEY) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized - Invalid API key',
      });
    }

    const payload = req.body;

    // Helper function to convert $oid to ObjectId
    const convertOidToObjectId = (obj) => {
      if (!obj) return null;
      
      // If it's already a string, convert to ObjectId
      if (typeof obj === 'string') {
        return mongoose.Types.ObjectId.isValid(obj) ? new mongoose.Types.ObjectId(obj) : null;
      }
      
      // If it has $oid property (n8n format)
      if (obj.$oid && typeof obj.$oid === 'string') {
        return mongoose.Types.ObjectId.isValid(obj.$oid) ? new mongoose.Types.ObjectId(obj.$oid) : null;
      }
      
      // If it's already an ObjectId, return as-is
      if (obj instanceof mongoose.Types.ObjectId) {
        return obj;
      }
      
      return null;
    };

    // Convert userId and brandId from $oid format to ObjectId
    const userId = convertOidToObjectId(payload.userId);
    const brandId = convertOidToObjectId(payload.brandId);

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or missing userId in payload',
      });
    }

    // Calculate statistics from reportData
    const reportData = payload.reportData || [];
    const stats = {
      totalPrompts: reportData.length,
      websiteFound: 0,
      brandMentioned: 0,
      totalFindings: 0,
    };

    reportData.forEach(item => {
      if (item.response && Array.isArray(item.response)) {
        item.response.forEach(platformData => {
          if (platformData.details?.websiteFound) stats.websiteFound++;
          if (platformData.details?.brandMentionFound) stats.brandMentioned++;
          if (platformData.found) stats.totalFindings++;
        });
      }
    });

    stats.successRate = stats.totalPrompts > 0 
      ? Math.round((reportData.filter(r => r.success).length / stats.totalPrompts) * 100)
      : 0;

    // Create report document
    const report = await Report.create({
      userId: userId,
      brandId: brandId,
      searchScope: payload.searchScope || 'national',
      location: payload.location || null,
      country: payload.country || 'US',
      language: payload.language || 'English',
      brandName: payload.brandName,
      brandUrl: payload.brandUrl,
      favicon: payload.favicon,
      platforms: payload.platforms || {
        chatgpt: false,
        perplexity: false,
        googleAiOverviews: false
      },
      reportData: reportData,
      stats: stats,
      status: payload.status || 'completed',
      reportDate: payload.reportDate ? new Date(payload.reportDate) : new Date(),
    });

    console.log('✅ N8N report saved successfully:', {
      reportId: report._id,
      userId: userId.toString(),
      brandId: brandId ? brandId.toString() : 'none',
      brandName: payload.brandName,
    });

    // Automatically find and update the scheduled prompt for this brand/user
    let scheduledPromptUpdate = null;
    if (brandId) {
      try {
        // Find the most recent active scheduled prompt that is due for this brand/user
        const scheduledPrompt = await ScheduledPrompt.findOne({
          user: userId,
          brandId: brandId,
          isActive: true,
          nextRun: { $lte: new Date() } // Only update prompts that are due
        }).sort({ nextRun: 1 }); // Get the one that's been waiting longest
        
        if (scheduledPrompt) {
          // Use provided reportDate or report's date
          const lastRunDate = payload.reportDate ? new Date(payload.reportDate) : report.reportDate || new Date();
          
          scheduledPrompt.lastRun = lastRunDate;
          scheduledPrompt.lastReportId = report._id;
          
          // Calculate next run based on frequency
          const nextRun = new Date(lastRunDate);
          switch (scheduledPrompt.scheduleFrequency) {
            case 'daily':
              nextRun.setDate(nextRun.getDate() + 1);
              break;
            case 'weekly':
              nextRun.setDate(nextRun.getDate() + 7);
              break;
            case 'monthly':
              nextRun.setMonth(nextRun.getMonth() + 1);
              break;
            default:
              nextRun.setDate(nextRun.getDate() + 1);
          }
          
          scheduledPrompt.nextRun = nextRun;
          scheduledPrompt.lastUpdated = new Date();
          
          await scheduledPrompt.save();
          
          scheduledPromptUpdate = {
            scheduledPromptId: scheduledPrompt._id,
            lastRun: scheduledPrompt.lastRun,
            nextRun: scheduledPrompt.nextRun,
            scheduleFrequency: scheduledPrompt.scheduleFrequency,
          };
          
          console.log('✅ Scheduled prompt updated automatically:', {
            scheduledPromptId: scheduledPrompt._id.toString(),
            brandName: scheduledPrompt.brandName,
            lastRun: scheduledPrompt.lastRun,
            nextRun: scheduledPrompt.nextRun,
          });
        } else {
          console.log('ℹ️ No active scheduled prompt found for this brand/user (or none are due)');
        }
      } catch (updateError) {
        console.error('❌ Error updating scheduled prompt:', updateError);
        // Don't fail the whole request if scheduled prompt update fails
      }
    }

    res.status(201).json({
      success: true,
      message: 'Report saved successfully via n8n webhook',
      data: {
        reportId: report._id,
        userId: report.userId,
        brandId: report.brandId,
        brandName: report.brandName,
        stats: report.stats,
        scheduledPromptUpdate: scheduledPromptUpdate,
      },
    });
  } catch (error) {
    console.error('❌ N8N save report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save report via n8n webhook',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
};
