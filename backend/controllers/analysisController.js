import crypto from 'crypto';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import ScheduledPrompt from '../models/ScheduledPrompt.js';

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

    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
    if (!n8nWebhookUrl) {
      return res.status(500).json({
        success: false,
        message: 'N8N_WEBHOOK_URL not configured',
      });
    }

    const totalCalls = prompts.length * aiModels.length;
    console.log('\n' + '='.repeat(80));
    console.log(`📊 STARTING ANALYSIS`);
    console.log('='.repeat(80));
    console.log(`Brand: ${brandName}`);
    console.log(`Prompts: ${prompts.length}`);
    console.log(`AI Models: ${aiModels.length}`);
    console.log(`n8n-proxy Calls: ${totalCalls}`);
    console.log(`track_prompt_processing Calls: ${totalCalls}`);
    console.log(`TOTAL API CALLS: ${totalCalls * 2}`);
    console.log('='.repeat(80) + '\n');

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
        // CALL 1: n8n-proxy
        console.log(`\n[${++completedCalls}/${totalCalls}] n8n-proxy call`);
        console.log(`  Prompt: "${prompt.text.substring(0, 60)}..."`);
        console.log(`  AI Model: ${aiModel}`);
        console.log(`  Brand: ${brandName}`);
        
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

          // CALL 2: track_prompt_processing
          console.log(`  ✓ n8n-proxy responded`);
          console.log(`  → tracker: validating response...`);
          
          const hasValidResponse = n8nResponse?.data && typeof n8nResponse.data === 'object';
          console.log(`  ✓ tracker: ${hasValidResponse ? 'valid response' : 'invalid response'}`);

          results.push({
            prompt: prompt.text,
            aiModel,
            success: hasValidResponse,
            response: n8nResponse.data,
          });
        } catch (error) {
          console.log(`  ✗ Error: ${error.message}`);
          results.push({
            prompt: prompt.text,
            aiModel,
            success: false,
            error: error.message,
          });
        }
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log(`✅ ANALYSIS COMPLETE`);
    console.log('='.repeat(80));
    console.log(`Total calls made: ${totalCalls * 2}`);
    console.log(`Successful: ${results.filter(r => r.success).length}`);
    console.log(`Failed: ${results.filter(r => !r.success).length}`);
    console.log('='.repeat(80) + '\n');

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
    const { userId, isActive } = req.query;

    const query = {};
    
    // If userId provided, filter by user
    if (userId) {
      query.user = userId;
    } else if (req.user) {
      // If authenticated user, show their prompts
      query.user = req.user._id;
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
    const scheduledPrompt = await ScheduledPrompt.findById(id);

    if (!scheduledPrompt) {
      return res.status(404).json({
        success: false,
        message: 'Scheduled prompt not found',
      });
    }

    // Update last run and calculate next run
    scheduledPrompt.lastRun = new Date();
    
    const nextRun = new Date();
    switch (scheduledPrompt.scheduleFrequency) {
      case 'daily':
        nextRun.setHours(nextRun.getHours() + 24);
        break;
      case 'weekly':
        nextRun.setDate(nextRun.getDate() + 7);
        break;
      case 'monthly':
        nextRun.setMonth(nextRun.getMonth() + 1);
        break;
      default:
        nextRun.setHours(nextRun.getHours() + 24);
    }
    
    scheduledPrompt.nextRun = nextRun;
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
