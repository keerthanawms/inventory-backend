/**
 * ML Controller
 * Exposes three AI/ML endpoints:
 *   GET /api/ml/demand-forecast      — Linear Regression demand prediction (Student 1 & 4)
 *   GET /api/ml/anomalies            — Isolation Forest transaction anomaly detection (Student 1 & 3)
 *   GET /api/ml/location-utilisation — Location utilisation scoring model (Student 2)
 */

const { runDemandForecast }       = require('../ml/demandForecast');
const { runIsolationForest }      = require('../ml/isolationForest');
const { runLocationUtilisation }  = require('../ml/locationUtilisation');

// ── Demand Forecast ────────────────────────────────────────────────────────
exports.getDemandForecast = async (req, res) => {
    try {
        const result = await runDemandForecast();
        res.json(result);
    } catch (err) {
        console.error('Demand Forecast error:', err);
        res.status(500).json({ message: err.message });
    }
};

// ── Isolation Forest Anomaly Detection ────────────────────────────────────
exports.getMLAnomalies = async (req, res) => {
    try {
        const result = await runIsolationForest();
        res.json(result);
    } catch (err) {
        console.error('Isolation Forest error:', err);
        res.status(500).json({ message: err.message });
    }
};

// ── Location Utilisation ──────────────────────────────────────────────────
exports.getLocationUtilisation = async (req, res) => {
    try {
        const result = await runLocationUtilisation();
        res.json(result);
    } catch (err) {
        console.error('Location Utilisation error:', err);
        res.status(500).json({ message: err.message });
    }
};
