/**
 * Mock Government API endpoints
 * Simulates government scheme application submission and status tracking
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

const router = Router();

// In-memory store for mock government applications
interface GovApplication {
  gov_application_id: string;
  application_id: string;
  scheme_id: string;
  status: string;
  status_history: Array<{
    status: string;
    timestamp: string;
    message: string;
  }>;
  submitted_at: string;
}

const govApplications: Map<string, GovApplication> = new Map();

// Status progression simulation
const STATUS_PROGRESSION = [
  'RECEIVED',
  'UNDER_REVIEW',
  'DOCUMENT_VERIFICATION',
  'APPROVED' // or 'REJECTED' for some
];

/**
 * POST /api/v1/mock/gov/submit
 * Simulate submitting application to government portal
 */
router.post('/submit', async (req: Request, res: Response) => {
  const { application_id, scheme_id, profile_id, form_data } = req.body;
  
  // Simulate processing delay
  const delay = parseInt(process.env.MOCK_GOV_DELAY_MS || '500');
  await new Promise(resolve => setTimeout(resolve, delay));
  
  const gov_application_id = `GOV-${uuidv4().slice(0, 8).toUpperCase()}`;
  const now = new Date().toISOString();
  
  const govApp: GovApplication = {
    gov_application_id,
    application_id,
    scheme_id,
    status: 'RECEIVED',
    status_history: [
      {
        status: 'RECEIVED',
        timestamp: now,
        message: 'Application received by government portal'
      }
    ],
    submitted_at: now
  };
  
  govApplications.set(gov_application_id, govApp);
  
  logger.info(`Mock Gov: Application received - ${gov_application_id}`);
  
  res.status(201).json({
    gov_application_id,
    status: 'RECEIVED',
    message: 'Application received successfully',
    reference_number: gov_application_id
  });
});

/**
 * GET /api/v1/mock/gov/status/:id
 * Get application status from mock government portal
 */
router.get('/status/:id', async (req: Request, res: Response) => {
  const govApp = govApplications.get(req.params.id);
  
  if (!govApp) {
    return res.status(404).json({ error: 'Application not found' });
  }
  
  // Simulate status progression based on time
  const submittedTime = new Date(govApp.submitted_at).getTime();
  const elapsed = Date.now() - submittedTime;
  const minutesElapsed = elapsed / (1000 * 60);
  
  // Progress status every 2 minutes for demo
  const statusIndex = Math.min(
    Math.floor(minutesElapsed / 2),
    STATUS_PROGRESSION.length - 1
  );
  
  const newStatus = STATUS_PROGRESSION[statusIndex];
  
  // Update status if changed
  if (newStatus !== govApp.status) {
    govApp.status = newStatus;
    govApp.status_history.push({
      status: newStatus,
      timestamp: new Date().toISOString(),
      message: getStatusMessage(newStatus)
    });
    govApplications.set(govApp.gov_application_id, govApp);
  }
  
  res.json({
    gov_application_id: govApp.gov_application_id,
    status: govApp.status,
    message: getStatusMessage(govApp.status),
    status_history: govApp.status_history,
    submitted_at: govApp.submitted_at
  });
});

/**
 * GET /api/v1/mock/gov/schemes
 * Get list of schemes from mock government database
 */
router.get('/schemes', async (req: Request, res: Response) => {
  // Return mock scheme list
  res.json({
    schemes: [
      { id: 'PM-KISAN-001', name: 'PM-KISAN Samman Nidhi', active: true },
      { id: 'PMFBY-003', name: 'PM Fasal Bima Yojana', active: true },
      { id: 'KCC-004', name: 'Kisan Credit Card', active: true }
    ]
  });
});

function getStatusMessage(status: string): string {
  const messages: Record<string, string> = {
    'RECEIVED': 'Application has been received and is pending review',
    'UNDER_REVIEW': 'Application is being reviewed by the department',
    'DOCUMENT_VERIFICATION': 'Documents are being verified',
    'APPROVED': 'Application has been approved! Benefit will be disbursed soon',
    'REJECTED': 'Application was rejected. Please check the remarks'
  };
  return messages[status] || 'Status unknown';
}

export default router;
