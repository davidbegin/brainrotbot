import { Router } from 'express';
import agentRoutes from './agentRoutes';
import messageRoutes from './messageRoutes';
import characterRoutes from './characterRoutes';

const router = Router();

// API routes
router.use('/agents', agentRoutes);
router.use('/messages', messageRoutes);
router.use('/characters', characterRoutes);

export default router;