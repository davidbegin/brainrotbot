import { Router } from 'express';
import { MessageController } from '../controllers/messageController';
import { authenticate } from '../middleware/auth';

const router = Router();

// All message routes require authentication
// router.use(authenticate);

// Message endpoints
router.post('/brainrot', MessageController.brainrot);
router.post('/send', MessageController.sendMessage);
router.post('/respond', MessageController.respondToMessage);
router.post('/ignore', MessageController.ignoreMessage);
router.get('/inbox', MessageController.checkInbox);
router.get('/history', MessageController.getConversationHistory);

export default router;
