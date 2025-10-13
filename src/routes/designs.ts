import { Router } from 'express';

const router = Router();

// GET /designs - Get all designs (with optional active filter)
router.get('/', (req, res) => {
  res.status(501).json({ message: 'Get all designs - Controller not implemented yet' });
});

// GET /designs/:id - Get design by ID
router.get('/:id', (req, res) => {
  res.status(501).json({ message: 'Get design by ID - Controller not implemented yet' });
});

// POST /designs - Create new design
router.post('/', (req, res) => {
  res.status(501).json({ message: 'Create design - Controller not implemented yet' });
});

// PUT /designs/:id - Update design
router.put('/:id', (req, res) => {
  res.status(501).json({ message: 'Update design - Controller not implemented yet' });
});

// DELETE /designs/:id - Delete design (soft delete by setting is_active to false)
router.delete('/:id', (req, res) => {
  res.status(501).json({ message: 'Delete design - Controller not implemented yet' });
});

// GET /designs/:id/measurements - Get required measurements for a design
router.get('/:id/measurements', (req, res) => {
  res.status(501).json({ message: 'Get design measurements - Controller not implemented yet' });
});

// POST /designs/:id/measurements - Add required measurement to design
router.post('/:id/measurements', (req, res) => {
  res.status(501).json({ message: 'Add design measurement - Controller not implemented yet' });
});

// DELETE /designs/:id/measurements/:measurementTypeId - Remove required measurement from design
router.delete('/:id/measurements/:measurementTypeId', (req, res) => {
  res.status(501).json({ message: 'Remove design measurement - Controller not implemented yet' });
});

// GET /designs/freesewing/:pattern - Get design by FreeSewing pattern name
router.get('/freesewing/:pattern', (req, res) => {
  res.status(501).json({ message: 'Get design by FreeSewing pattern - Controller not implemented yet' });
});

// GET /designs/active - Get only active designs
router.get('/active', (req, res) => {
  res.status(501).json({ message: 'Get active designs - Controller not implemented yet' });
});

export default router;