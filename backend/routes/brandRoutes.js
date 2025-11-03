import express from 'express';
import { 
  getFavicon, 
  saveBrand, 
  getUserBrands, 
  getBrandById, 
  deleteBrand 
} from '../controllers/brandController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Get favicon for a website URL
router.get('/favicon', protect, getFavicon);

// Brand CRUD operations
router.post('/save', protect, saveBrand);
router.get('/list', protect, getUserBrands);
router.get('/:id', protect, getBrandById);
router.delete('/:id', protect, deleteBrand);

export default router;
