import express from 'express';
import { submitReport, getPublicSuggestions, getPublicNotice } from '../controllers/reportController.js';
import upload from '../middleware/upload.js';
import { reportSubmissionLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Public report submission endpoint
router.post('/', reportSubmissionLimiter, upload.array('images', 3), submitReport);

// Public helper endpoints (strictly non-sensitive)
router.get('/suggestions', getPublicSuggestions);
router.get('/notice', getPublicNotice);

export default router;
