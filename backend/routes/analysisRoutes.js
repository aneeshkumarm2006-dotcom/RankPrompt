import express from 'express';
import {
  storePromptsForScheduling,
  initiateAnalysis,
  getScheduledPrompts,
  getPromptsDue,
  updateScheduledPromptRun,
  receiveN8nResult,
  generateWebhookToken,
  scheduleFromReport,
  toggleScheduledPrompt,
  deleteScheduledPrompt,
} from '../controllers/analysisController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Protected routes (require authentication)
router.post('/store-prompts', protect, storePromptsForScheduling);
router.post('/initiate', protect, initiateAnalysis);
router.get('/scheduled-prompts', protect, getScheduledPrompts);
router.post('/generate-webhook-token', protect, generateWebhookToken);
router.post('/schedule-from-report', protect, scheduleFromReport);
router.put('/scheduled-prompts/:id/toggle', protect, toggleScheduledPrompt);
router.delete('/scheduled-prompts/:id', protect, deleteScheduledPrompt);

// Public routes for n8n (protected by API key in controller)
router.get('/prompts-due', getPromptsDue);
router.put('/scheduled-prompts/:id/update-run', updateScheduledPromptRun);
router.post('/webhook/result', receiveN8nResult);

export default router;
