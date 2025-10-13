import { Router } from 'express';
import userRoutes from './users';
import measurementTypeRoutes from './measurementTypes';
import userMeasurementRoutes from './userMeasurements';
import designRoutes from './designs';
import patternRoutes from './patterns';
import orderRoutes from './orders';

const router = Router();

// Mount all route modules
router.use('/users', userRoutes);
router.use('/measurement-types', measurementTypeRoutes);
router.use('/user-measurements', userMeasurementRoutes);
router.use('/designs', designRoutes);
router.use('/patterns', patternRoutes);
router.use('/orders', orderRoutes);

export default router;