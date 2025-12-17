import express from 'express';
import {
  saveReport,
  getUserReports,
  getReportById,
  shareReport,
  getSharedReport,
  deleteReport,
  saveInProgressReport,
  getReportByBrandId,
  getReportsByBrand,
  getVisibilityTrend,
  runCompetitorComparison,
  getCompetitorComparison,
  resetCompetitorComparison,
} from '../controllers/reportController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Protected routes
router.post('/save', protect, saveReport);
router.post('/save-progress', protect, saveInProgressReport);
router.get('/list', protect, getUserReports);
router.get('/by-brand/:brandId', protect, getReportByBrandId);
router.get('/brand/:brandId', protect, getReportsByBrand);
router.get('/brand/:brandId/all', protect, getReportsByBrand);
router.get('/brand/:brandId/visibility-trend', protect, getVisibilityTrend);
router.get('/:id', protect, getReportById);
router.post('/:id/share', protect, shareReport);
router.delete('/:id', protect, deleteReport);
router.post('/:id/competitor-comparison', protect, runCompetitorComparison);
router.get('/:id/competitor-comparison', protect, getCompetitorComparison);
router.delete('/:id/competitor-comparison', protect, resetCompetitorComparison);

// Public route for shared reports
router.get('/shared/:token', getSharedReport);

export default router;
