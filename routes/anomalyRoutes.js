/**
 * Anomaly Detection Routes
 * Returns AI-style rule-based anomalies from inventory, stock-in, and stock-out data.
 * Accessible by admin and warehouse_manager only (enforced in frontend; backend auth required).
 */

const express = require('express');
const { getAnomalies } = require('../controllers/anomalyController');
const authMiddleware = require('../middleware/authMiddleware');
const router = express.Router();

// GET /api/anomalies — analyse all inventory data and return detected anomalies
router.get('/', authMiddleware, getAnomalies);

module.exports = router;
