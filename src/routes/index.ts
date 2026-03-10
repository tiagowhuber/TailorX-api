import { Router } from 'express';
import authRoutes from './auth';
import userRoutes from './users';
import measurementTypeRoutes from './measurementTypes';
import userMeasurementRoutes from './userMeasurements';
import designRoutes from './designs';
import patternRoutes from './patterns';
import orderRoutes from './orders';
import discountCodeRoutes from './discountCodeRoutes';
import paymentRoutes from './paymentRoutes';
import tailorVisionRoutes from './tailorVision';
import userAddressRoutes from './userAddresses';


const router = Router();

// Mount all route modules
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/measurement-types', measurementTypeRoutes);
router.use('/user-measurements', userMeasurementRoutes);
router.use('/designs', designRoutes);
router.use('/patterns', patternRoutes);
router.use('/orders', orderRoutes);
router.use('/discount-codes', discountCodeRoutes);
router.use('/payments', paymentRoutes);
router.use('/tailor-vision', tailorVisionRoutes);
router.use('/user-addresses', userAddressRoutes);
router.use('/tailor-vision', tailorVisionRoutes);

export default router;