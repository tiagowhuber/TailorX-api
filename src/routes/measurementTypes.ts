import { Router } from 'express';

const router = Router();

// GET /measurement-types - Get all measurement types
router.get('/', (req, res) => {
  res.status(501).json({ message: 'Get all measurement types - Controller not implemented yet' });
});

// GET /measurement-types/:id - Get measurement type by ID
router.get('/:id', (req, res) => {
  res.status(501).json({ message: 'Get measurement type by ID - Controller not implemented yet' });
});

// POST /measurement-types - Create new measurement type
router.post('/', (req, res) => {
  res.status(501).json({ message: 'Create measurement type - Controller not implemented yet' });
});

// PUT /measurement-types/:id - Update measurement type
router.put('/:id', (req, res) => {
  res.status(501).json({ message: 'Update measurement type - Controller not implemented yet' });
});

// DELETE /measurement-types/:id - Delete measurement type
router.delete('/:id', (req, res) => {
  res.status(501).json({ message: 'Delete measurement type - Controller not implemented yet' });
});

// GET /measurement-types/freesewing/:key - Get measurement type by FreeSewing key
router.get('/freesewing/:key', (req, res) => {
  res.status(501).json({ message: 'Get measurement type by FreeSewing key - Controller not implemented yet' });
});

export default router;