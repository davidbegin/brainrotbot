import { Router } from 'express';
import { AgentController } from '../controllers/agentController';
import { authenticate } from '../middleware/auth';

const router = Router();

// Public route - no authentication required
router.post('/register', AgentController.registerAgent);

// Protected routes - require API key
router.get('/info', authenticate, AgentController.getAgentInfo);

export default router;