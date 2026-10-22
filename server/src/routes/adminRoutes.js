import express from 'express';
import {
  login,
  logout,
  me,
  getDashboardOverview,
  listReports,
  getReportDetail,
  updateReportStatus,
  servePrivateImage,
  listAlerts,
  updateAlertState,
  getSettings,
  updateSettings,
  listResponderContacts,
  createOrUpdateContact,
  logResponderAction,
  listAuditLogs
} from '../controllers/adminController.js';
import { requireAdminAuth } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Authentication
router.post('/login', authLimiter, login);
router.post('/logout', requireAdminAuth, logout);
router.get('/me', requireAdminAuth, me);

// Dashboard overview & metrics
router.get('/overview', requireAdminAuth, getDashboardOverview);

// Reports management
router.get('/reports', requireAdminAuth, listReports);
router.get('/reports/:id', requireAdminAuth, getReportDetail);
router.patch('/reports/:id/status', requireAdminAuth, updateReportStatus);

// Private image access (checks either admin session cookie or signed token)
router.get('/reports/:reportId/images/:imageId', servePrivateImage);

// Location-based Alerts & Clusters
router.get('/alerts', requireAdminAuth, listAlerts);
router.patch('/alerts/:id', requireAdminAuth, updateAlertState);

// Threshold & Window Settings
router.get('/settings', requireAdminAuth, getSettings);
router.put('/settings', requireAdminAuth, updateSettings);

// Responder Contacts (Deliberate Action)
router.get('/responders', requireAdminAuth, listResponderContacts);
router.post('/responders', requireAdminAuth, createOrUpdateContact);
router.put('/responders/:id', requireAdminAuth, createOrUpdateContact);
router.post('/responders/action-log', requireAdminAuth, logResponderAction);

// Audit Trail
router.get('/audit-logs', requireAdminAuth, listAuditLogs);

export default router;
