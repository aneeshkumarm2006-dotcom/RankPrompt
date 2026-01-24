import https from 'https';
import http from 'http';
import Brand from '../models/Brand.js';
import Report from '../models/Report.js';
import ScheduledPrompt from '../models/ScheduledPrompt.js';

// Brand limits based on subscription tier
const BRAND_LIMITS = {
  free: 1,
  starter: 1,
  pro: 3,
  agency: 5,
};

/**
 * Get brand limit for a subscription tier
 * @param {string} tier - Subscription tier (free, starter, pro, agency)
 * @returns {number} - Maximum number of brands allowed
 */
const getBrandLimit = (tier) => {
  return BRAND_LIMITS[tier] || BRAND_LIMITS.free;
};

/**
 * @desc    Get favicon for a website URL
 * @route   GET /api/brand/favicon?url=...
 * @access  Private
 */
export const getFavicon = async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({
        success: false,
        message: 'URL parameter is required',
      });
    }

    // Parse and validate URL
    let domain;
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
      domain = urlObj.hostname;
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid URL format',
      });
    }

    // List of common favicon locations to try
    const faviconUrls = [
      `https://${domain}/favicon.ico`,
      `https://${domain}/favicon.png`,
      `https://${domain}/apple-touch-icon.png`,
      `https://${domain}/apple-touch-icon-precomposed.png`,
      `http://${domain}/favicon.ico`,
      // Fallback to Google's favicon service
      `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
    ];

    // Function to check if favicon exists
    const checkFavicon = (faviconUrl) => {
      return new Promise((resolve) => {
        const protocol = faviconUrl.startsWith('https://') ? https : http;
        
        protocol.get(faviconUrl, { timeout: 3000 }, (response) => {
          if (response.statusCode === 200) {
            resolve(faviconUrl);
          } else {
            resolve(null);
          }
        }).on('error', () => {
          resolve(null);
        }).on('timeout', () => {
          resolve(null);
        });
      });
    };

    // Try each favicon URL
    let foundFavicon = null;
    for (const faviconUrl of faviconUrls) {
      foundFavicon = await checkFavicon(faviconUrl);
      if (foundFavicon) break;
    }

    if (foundFavicon) {
      res.status(200).json({
        success: true,
        faviconUrl: foundFavicon,
        domain,
      });
    } else {
      // Return Google's favicon service as ultimate fallback
      res.status(200).json({
        success: true,
        faviconUrl: `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
        domain,
        fallback: true,
      });
    }
  } catch (error) {
    console.error('Error fetching favicon:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching favicon',
      error: error.message,
    });
  }
};

/**
 * @desc    Create/Save a new brand
 * @route   POST /api/brand/save
 * @access  Private
 */
export const saveBrand = async (req, res) => {
  try {
    const { brandName, websiteUrl, favicon } = req.body;
    const userId = req.user._id;
    const userTier = req.user.subscriptionTier || req.user.currentPlan || 'free';

    if (!brandName || !websiteUrl) {
      return res.status(400).json({
        success: false,
        message: 'Brand name and website URL are required',
      });
    }

    // Check brand limit based on subscription tier
    const currentBrandCount = await Brand.countDocuments({ userId, isActive: true });
    const brandLimit = getBrandLimit(userTier);

    if (currentBrandCount >= brandLimit) {
      return res.status(403).json({
        success: false,
        message: `You have reached your brand limit (${brandLimit} brand${brandLimit > 1 ? 's' : ''}) for the ${userTier} plan. Please upgrade your subscription to add more brands.`,
        code: 'BRAND_LIMIT_REACHED',
        currentCount: currentBrandCount,
        limit: brandLimit,
        tier: userTier,
      });
    }

    // Check if brand already exists for this user
    const existingBrand = await Brand.findOne({ userId, brandName });
    if (existingBrand) {
      return res.status(400).json({
        success: false,
        message: 'Brand already exists',
      });
    }

    const brand = await Brand.create({
      userId,
      brandName,
      websiteUrl,
      favicon,
    });

    res.status(201).json({
      success: true,
      data: brand,
    });
  } catch (error) {
    console.error('Error saving brand:', error);
    res.status(500).json({
      success: false,
      message: 'Error saving brand',
      error: error.message,
    });
  }
};

/**
 * @desc    Get all brands for current user
 * @route   GET /api/brand/list
 * @access  Private
 */
export const getUserBrands = async (req, res) => {
  try {
    const userId = req.user._id;

    const brands = await Brand.find({ userId, isActive: true })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: brands,
    });
  } catch (error) {
    console.error('Error fetching brands:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching brands',
      error: error.message,
    });
  }
};

/**
 * @desc    Get single brand by ID
 * @route   GET /api/brand/:id
 * @access  Private
 */
export const getBrandById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const brand = await Brand.findOne({ _id: id, userId });

    if (!brand) {
      return res.status(404).json({
        success: false,
        message: 'Brand not found',
      });
    }

    res.status(200).json({
      success: true,
      data: brand,
    });
  } catch (error) {
    console.error('Error fetching brand:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching brand',
      error: error.message,
    });
  }
};

/**
 * @desc    Delete a brand and all associated data
 * @route   DELETE /api/brand/:id
 * @access  Private
 */
export const deleteBrand = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    // Find the brand first to ensure it exists and belongs to the user
    const brand = await Brand.findOne({ _id: id, userId });

    if (!brand) {
      return res.status(404).json({
        success: false,
        message: 'Brand not found',
      });
    }

    // Delete all reports associated with this brand
    const deletedReports = await Report.deleteMany({
      brandId: id,
      userId: userId
    });

    // Delete all scheduled prompts associated with this brand
    const deletedSchedules = await ScheduledPrompt.deleteMany({
      brandId: id,
      user: userId
    });

    // Finally, delete the brand itself
    await Brand.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Brand and all associated data deleted successfully',
      deletedData: {
        reports: deletedReports.deletedCount,
        schedules: deletedSchedules.deletedCount,
      }
    });
  } catch (error) {
    console.error('Error deleting brand:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting brand',
      error: error.message,
    });
  }
};

/**
 * @desc    Get brand limit info for current user
 * @route   GET /api/brand/limit-info
 * @access  Private
 */
export const getBrandLimitInfo = async (req, res) => {
  try {
    const userId = req.user._id;
    const userTier = req.user.subscriptionTier || req.user.currentPlan || 'free';

    const currentBrandCount = await Brand.countDocuments({ userId, isActive: true });
    const brandLimit = getBrandLimit(userTier);

    res.status(200).json({
      success: true,
      data: {
        currentCount: currentBrandCount,
        limit: brandLimit,
        remaining: Math.max(0, brandLimit - currentBrandCount),
        tier: userTier,
        canCreateMore: currentBrandCount < brandLimit,
        allLimits: BRAND_LIMITS,
      },
    });
  } catch (error) {
    console.error('Error fetching brand limit info:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching brand limit info',
      error: error.message,
    });
  }
};
