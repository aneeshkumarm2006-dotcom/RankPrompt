import express from 'express';
import {
  saveReport,
  getUserReports,
  getReportById,
  shareReport,
  getSharedReport,
  deleteReport,
} from '../controllers/reportController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Protected routes
router.post('/save', protect, saveReport);
router.get('/list', protect, getUserReports);
router.get('/:id', protect, getReportById);
router.post('/:id/share', protect, shareReport);
router.delete('/:id', protect, deleteReport);

// Public route for shared reports
router.get('/shared/:token', getSharedReport);

export default router;
