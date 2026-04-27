/**
 * Location Routes
 * CRUD operations for warehouse locations (zones, sections, racks).
 * All routes require authentication.
 */

const express = require('express');
const {
    getAll,
    create,
    delete: deleteLocation
} = require('../controllers/locationController');
const authMiddleware = require('../middleware/authMiddleware');
const router = express.Router();

// Get all locations
router.get('/', authMiddleware, getAll);

// Create a new location (zone, section, rack)
router.post('/', authMiddleware, create);

// Delete a location by ID
router.delete('/:id', authMiddleware, deleteLocation);

module.exports = router;