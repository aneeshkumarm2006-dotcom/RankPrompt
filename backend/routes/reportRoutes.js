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
} from '../controllers/reportController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Protected routes
router.post('/save', protect, saveReport);
router.post('/save-progress', protect, saveInProgressReport);
router.get('/list', protect, getUserReports);
router.get('/by-brand/:brandId', protect, getReportByBrandId);
router.get('/brand/:brandId/all', protect, getReportsByBrand);
router.get('/:id', protect, getReportById);
router.post('/:id/share', protect, shareReport);
router.delete('/:id', protect, deleteReport);

// Public route for shared reports
router.get('/shared/:token', getSharedReport);

export default router;
