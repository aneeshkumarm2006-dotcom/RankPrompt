import express from 'express';
import { 
  getFavicon, 
  saveBrand, 
  getUserBrands, 
  getBrandById, 
  deleteBrand,
  getBrandLimitInfo 
} from '../controllers/brandController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Get favicon for a website URL
router.get('/favicon', protect, getFavicon);

// Get brand limit info for current user
router.get('/limit-info', protect, getBrandLimitInfo);

// Brand CRUD operations
router.post('/save', protect, saveBrand);
router.get('/list', protect, getUserBrands);
router.get('/:id', protect, getBrandById);
router.delete('/:id', protect, deleteBrand);

export default router;
