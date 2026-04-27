/**
 * ML Routes
 * All routes require authentication (JWT).
 * Demand forecast and anomaly detection: admin + warehouse_manager
 * Location utilisation: admin + warehouse_manager
 */

const express = require('express');
const {
    getDemandForecast,
    getMLAnomalies,
    getLocationUtilisation
} = require('../controllers/mlController');
const authMiddleware = require('../middleware/authMiddleware');
const router = express.Router();

// GET /api/ml/demand-forecast — Linear Regression demand prediction
router.get('/demand-forecast', authMiddleware, getDemandForecast);

// GET /api/ml/anomalies — Isolation Forest anomaly detection
router.get('/anomalies', authMiddleware, getMLAnomalies);

// GET /api/ml/location-utilisation — Location utilisation intelligence
router.get('/location-utilisation', authMiddleware, getLocationUtilisation);

module.exports = router;
