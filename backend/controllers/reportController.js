import Report from '../models/Report.js';
import PromptSent from '../models/PromptSent.js';
import PromptResponse from '../models/PromptResponse.js';
import User from '../models/User.js';
import crypto from 'crypto';

/**
 * @desc    Save report with all prompts and responses
 * @route   POST /api/reports/save
 * @access  Private
 */
export const saveReport = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      inProgressReportId, // ID of in-progress report to update (if exists)
      brandId, // Brand ID from frontend
      brandData,
      reportData,
      promptsSent, // Array of prompts sent to n8n
      promptsResponses, // Array of responses from n8n
      promptsCount, // Number of prompts generated for credit deduction
    } = req.body;

    if (!brandData || !reportData) {
      return res.status(400).json({
        success: false,
        message: 'Brand data and report data are required',
      });
    }

    // Deduct credits based on prompts count
    if (promptsCount && promptsCount > 0) {
      const user = await User.findById(userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      // Check if user has enough credits
      if (user.credits < promptsCount) {
        return res.status(400).json({
          success: false,
          message: 'Insufficient credits',
          creditsNeeded: promptsCount,
          creditsAvailable: user.credits,
        });
      }

      // Deduct credits and update usage
      user.credits -= promptsCount;
      user.creditsUsed += promptsCount;
      await user.save();
    }

    // Calculate statistics
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

    let report;

    // Check if we're updating an existing in-progress report
    if (inProgressReportId) {
      report = await Report.findOneAndUpdate(
        { _id: inProgressReportId, userId, status: 'in-progress' },
        {
          brandId: brandId || null, // Use brandId from request
          brandName: brandData.brandName,
          brandUrl: brandData.websiteUrl,
          favicon: brandData.favicon,
          searchScope: brandData.searchScope,
          location: brandData.location,
          country: brandData.country,
          language: brandData.language || 'English',
          platforms: brandData.platforms,
          reportData,
          stats,
          status: 'completed',
          progress: null, // Clear progress data
        },
        { new: true }
      );

      if (!report) {
        // If in-progress report not found, create new one
        report = await Report.create({
          userId,
          brandId: brandId || null, // Use brandId from request
          brandName: brandData.brandName,
          brandUrl: brandData.websiteUrl,
          favicon: brandData.favicon,
          searchScope: brandData.searchScope,
          location: brandData.location,
          country: brandData.country,
          language: brandData.language || 'English',
          platforms: brandData.platforms,
          reportData,
          stats,
          status: 'completed',
        });
      }
    } else {
      // Create new report
      report = await Report.create({
        userId,
        brandId: brandId || null, // Use brandId from request
        brandName: brandData.brandName,
        brandUrl: brandData.websiteUrl,
        favicon: brandData.favicon,
        searchScope: brandData.searchScope,
        location: brandData.location,
        country: brandData.country,
        language: brandData.language || 'English',
        platforms: brandData.platforms,
        reportData,
        stats,
        status: 'completed',
      });
    }

    // Save prompts sent (if provided)
    if (promptsSent && Array.isArray(promptsSent)) {
      const promptsSentDocs = promptsSent.map(p => ({
        ...p,
        userId,
        reportId: report._id,
      }));
      await PromptSent.insertMany(promptsSentDocs);
    }

    // Save prompt responses (if provided)
    if (promptsResponses && Array.isArray(promptsResponses)) {
      const promptsResponsesDocs = promptsResponses.map(p => ({
        ...p,
        userId,
        reportId: report._id,
      }));
      await PromptResponse.insertMany(promptsResponsesDocs);
    }

    res.status(201).json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error('Error saving report:', error);
    res.status(500).json({
      success: false,
      message: 'Error saving report',
      error: error.message,
    });
  }
};

/**
 * @desc    Get all reports for current user
 * @route   GET /api/reports/list
 * @access  Private
 */
export const getUserReports = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 20 } = req.query;

    const reports = await Report.find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('-reportData'); // Exclude large reportData field for list view

    const count = await Report.countDocuments({ userId });

    res.status(200).json({
      success: true,
      data: reports,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      total: count,
    });
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching reports',
      error: error.message,
    });
  }
};

/**
 * @desc    Get single report by ID
 * @route   GET /api/reports/:id
 * @access  Private
 */
export const getReportById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const report = await Report.findOne({ _id: id, userId });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found',
      });
    }

    res.status(200).json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error('Error fetching report:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching report',
      error: error.message,
    });
  }
};

/**
 * @desc    Generate shareable link for report
 * @route   POST /api/reports/:id/share
 * @access  Private
 */
export const shareReport = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const report = await Report.findOne({ _id: id, userId });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found',
      });
    }

    // Generate share token if not already exists
    if (!report.shareToken) {
      report.shareToken = crypto.randomBytes(16).toString('hex');
      report.isShared = true;
      await report.save();
    }

    const shareUrl = `${process.env.FRONTEND_URL}/shared/${report.shareToken}`;

    res.status(200).json({
      success: true,
      data: {
        shareToken: report.shareToken,
        shareUrl,
      },
    });
  } catch (error) {
    console.error('Error sharing report:', error);
    res.status(500).json({
      success: false,
      message: 'Error sharing report',
      error: error.message,
    });
  }
};

/**
 * @desc    Get shared report by token (public)
 * @route   GET /api/reports/shared/:token
 * @access  Public
 */
export const getSharedReport = async (req, res) => {
  try {
    const { token } = req.params;

    const report = await Report.findOne({ shareToken: token, isShared: true });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Shared report not found or has been made private',
      });
    }

    res.status(200).json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error('Error fetching shared report:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching shared report',
      error: error.message,
    });
  }
};

/**
 * @desc    Delete a report
 * @route   DELETE /api/reports/:id
 * @access  Private
 */
export const deleteReport = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const report = await Report.findOneAndDelete({ _id: id, userId });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found',
      });
    }

    // Optionally delete associated prompts and responses
    await PromptSent.deleteMany({ reportId: id });
    await PromptResponse.deleteMany({ reportId: id });

    res.status(200).json({
      success: true,
      message: 'Report deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting report:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting report',
      error: error.message,
    });
  }
};

/**
 * @desc    Save or update in-progress report
 * @route   POST /api/reports/save-progress
 * @access  Private
 */
export const saveInProgressReport = async (req, res) => {
  try {
    const userId = req.user._id;
    const { reportId, brandData, currentStep, formData, step2Data } = req.body;

    if (!brandData || !currentStep) {
      return res.status(400).json({
        success: false,
        message: 'Brand data and current step are required',
      });
    }

    let report;

    if (reportId) {
      // Update existing in-progress report
      report = await Report.findOneAndUpdate(
        { _id: reportId, userId, status: 'in-progress' },
        {
          brandId: brandData.brandId || null, // Update brandId when brand is saved
          brandName: brandData.brandName,
          brandUrl: brandData.websiteUrl,
          favicon: brandData.favicon,
          searchScope: brandData.searchScope,
          location: brandData.location,
          country: brandData.country,
          language: brandData.language,
          platforms: brandData.platforms,
          progress: {
            currentStep,
            formData,
            step2Data,
            lastUpdated: Date.now(),
          },
        },
        { new: true }
      );

      if (!report) {
        return res.status(404).json({
          success: false,
          message: 'In-progress report not found',
        });
      }
    } else {
      // Create new in-progress report
      report = await Report.create({
        userId,
        brandId: brandData.brandId || null,
        brandName: brandData.brandName,
        brandUrl: brandData.websiteUrl,
        favicon: brandData.favicon,
        searchScope: brandData.searchScope,
        location: brandData.location,
        country: brandData.country,
        language: brandData.language || 'English',
        platforms: brandData.platforms,
        reportData: [], // Empty for in-progress
        status: 'in-progress',
        progress: {
          currentStep,
          formData,
          step2Data,
          lastUpdated: Date.now(),
        },
      });
    }

    res.status(200).json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error('Error saving in-progress report:', error);
    res.status(500).json({
      success: false,
      message: 'Error saving in-progress report',
      error: error.message,
    });
  }
};

/**
 * @desc    Get report by brand ID (for navigation from sidebar)
 * @route   GET /api/reports/by-brand/:brandId
 * @access  Private
 */
export const getReportByBrandId = async (req, res) => {
  try {
    const { brandId } = req.params;
    const userId = req.user._id;

    // First, try to find the most recent completed report for this brand
    let report = await Report.findOne({ 
      brandId, 
      userId,
      status: 'completed'
    })
      .sort({ createdAt: -1 })
      .select('_id brandName status');

    // If no completed report exists, check for in-progress report
    if (!report) {
      report = await Report.findOne({ 
        brandId, 
        userId,
        status: 'in-progress'
      })
        .sort({ createdAt: -1 })
        .select('_id brandName status');
    }

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'No report found for this brand',
      });
    }

    res.status(200).json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error('Error fetching report by brand:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching report',
      error: error.message,
    });
  }
};

/**
 * @desc    Get all reports for a brand
 * @route   GET /api/reports/brand/:brandId
 * @route   GET /api/reports/brand/:brandId/all
 * @access  Private
 */
export const getReportsByBrand = async (req, res) => {
  try {
    const { brandId } = req.params;
    const userId = req.user._id;

    const reports = await Report.find({ 
      brandId, 
      userId,
      status: 'completed'
    })
      .sort({ createdAt: -1 });
      // Include reportData for dashboard analytics

    res.status(200).json({
      success: true,
      count: reports.length,
      data: reports,
    });
  } catch (error) {
    console.error('Error fetching reports by brand:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching reports',
      error: error.message,
    });
  }
};

/**
 * @desc    Get visibility trend data for a brand within a date range
 * @route   GET /api/reports/brand/:brandId/visibility-trend
 * @access  Private
 */
export const getVisibilityTrend = async (req, res) => {
  try {
    const { brandId } = req.params;
    const userId = req.user._id;
    const { startDate, endDate } = req.query;

    // Build query
    const query = {
      brandId,
      userId,
      status: 'completed',
    };

    // Add date range filter if provided
    if (startDate || endDate) {
      query.reportDate = {};
      if (startDate) {
        query.reportDate.$gte = new Date(startDate);
      }
      if (endDate) {
        // Add one day to include the end date fully
        const end = new Date(endDate);
        end.setDate(end.getDate() + 1);
        query.reportDate.$lt = end;
      }
    }

    const reports = await Report.find(query)
      .select('reportDate stats createdAt')
      .sort({ reportDate: 1 });

    // If less than 2 reports, return empty trend
    if (reports.length < 2) {
      return res.status(200).json({
        success: true,
        count: reports.length,
        data: [],
        message: reports.length === 0 
          ? 'No reports found for this brand' 
          : 'At least 2 reports are required to show trend',
      });
    }

    // Format data for chart
    const trendData = reports.map(report => ({
      date: report.reportDate || report.createdAt,
      websiteFound: report.stats?.websiteFound || 0,
      brandMentioned: report.stats?.brandMentioned || 0,
      successRate: report.stats?.successRate || 0,
      totalPrompts: report.stats?.totalPrompts || 0,
    }));

    res.status(200).json({
      success: true,
      count: trendData.length,
      data: trendData,
    });
  } catch (error) {
    console.error('Error fetching visibility trend:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching visibility trend',
      error: error.message,
    });
  }
};
