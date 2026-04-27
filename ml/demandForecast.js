/**
 * Demand Forecasting — Linear Regression (Pure JavaScript, no external ML library)
 * 
 * Spec compliance:
 *   - Student 1 (Haleema): "demand prediction method like Linear Regression or Random Forest
 *     trained on simulated historical transaction data"
 *   - Student 4 (Nikhil): "demand trend of the inventory will be predicted by a lightweight
 *     predictive model"
 *   - Evaluation: MAE and RMSE as specified
 *
 * How it works:
 *   1. Fetches all approved stock-out records from DB (last 90 days = training data)
 *   2. For each product, aggregates daily quantities → [day_index, quantity] pairs
 *   3. Fits a Simple Linear Regression: quantity = slope * day + intercept
 *   4. Predicts next 7 days of demand
 *   5. Evaluates on last 7 days holdout: computes MAE and RMSE
 */

const db = require('../config/db');

// ── Simple Linear Regression ───────────────────────────────────────────────
// Given arrays x[] and y[], returns { slope, intercept }
function linearRegression(x, y) {
    const n = x.length;
    if (n < 2) return { slope: 0, intercept: y[0] || 0 };

    const sumX  = x.reduce((a, b) => a + b, 0);
    const sumY  = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);
    const sumX2 = x.reduce((acc, xi) => acc + xi * xi, 0);

    const denom = (n * sumX2 - sumX * sumX);
    if (denom === 0) return { slope: 0, intercept: sumY / n };

    const slope     = (n * sumXY - sumX * sumY) / denom;
    const intercept = (sumY - slope * sumX) / n;
    return { slope, intercept };
}

// ── MAE ────────────────────────────────────────────────────────────────────
function mae(actual, predicted) {
    if (actual.length === 0) return 0;
    const sum = actual.reduce((acc, a, i) => acc + Math.abs(a - predicted[i]), 0);
    return parseFloat((sum / actual.length).toFixed(2));
}

// ── RMSE ───────────────────────────────────────────────────────────────────
function rmse(actual, predicted) {
    if (actual.length === 0) return 0;
    const sum = actual.reduce((acc, a, i) => acc + Math.pow(a - predicted[i], 2), 0);
    return parseFloat(Math.sqrt(sum / actual.length).toFixed(2));
}

// ── Main Forecast Function ─────────────────────────────────────────────────
async function runDemandForecast() {
    // Fetch all approved stock-out records with timestamps
    const [rows] = await db.query(`
        SELECT s.product_id, p.name AS product_name, s.quantity, s.timestamp
        FROM stock_out_requests s
        JOIN products p ON s.product_id = p.product_id
        WHERE s.status = 'approved'
        ORDER BY s.timestamp ASC
    `);

    if (rows.length === 0) {
        return { forecasts: [], trained_on: 0, generated_at: new Date().toISOString() };
    }

    // Find the earliest date to calculate day index
    const earliest = new Date(rows[0].timestamp);
    earliest.setHours(0, 0, 0, 0);

    // Group by product_id → { product_name, dailyMap: { dayIndex: totalQty } }
    const productMap = {};
    rows.forEach(r => {
        const pid = r.product_id;
        if (!productMap[pid]) {
            productMap[pid] = { product_name: r.product_name, dailyMap: {} };
        }
        const d = new Date(r.timestamp);
        d.setHours(0, 0, 0, 0);
        const dayIdx = Math.floor((d - earliest) / (1000 * 60 * 60 * 24));
        productMap[pid].dailyMap[dayIdx] = (productMap[pid].dailyMap[dayIdx] || 0) + r.quantity;
    });

    const forecasts = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIdx = Math.floor((today - earliest) / (1000 * 60 * 60 * 24));

    for (const pid of Object.keys(productMap)) {
        const { product_name, dailyMap } = productMap[pid];
        const days = Object.keys(dailyMap).map(Number).sort((a, b) => a - b);
        const quantities = days.map(d => dailyMap[d]);

        // Need at least 5 data points to forecast meaningfully
        if (days.length < 3) continue;

        // Split: holdout = last 7 days of data, training = rest
        const holdoutStart = days.length > 10 ? days.length - 7 : days.length - 2;
        const trainX = days.slice(0, holdoutStart);
        const trainY = quantities.slice(0, holdoutStart);
        const testX  = days.slice(holdoutStart);
        const testY  = quantities.slice(holdoutStart);

        // Train linear regression
        const { slope, intercept } = linearRegression(trainX, trainY);

        // Predict on test (holdout) set for evaluation
        const testPred = testX.map(x => Math.max(0, Math.round(slope * x + intercept)));

        // Compute MAE and RMSE
        const maeVal  = mae(testY, testPred);
        const rmseVal = rmse(testY, testPred);

        // Predict next 7 days from today
        const nextWeekPredictions = [];
        let totalNext7 = 0;
        for (let i = 1; i <= 7; i++) {
            const futureDay = todayIdx + i;
            const pred = Math.max(0, Math.round(slope * futureDay + intercept));
            const forecastDate = new Date(earliest);
            forecastDate.setDate(forecastDate.getDate() + futureDay);
            nextWeekPredictions.push({
                date: forecastDate.toISOString().split('T')[0],
                predicted_quantity: pred
            });
            totalNext7 += pred;
        }

        // Average daily demand from training data
        const avgDaily = parseFloat((trainY.reduce((a, b) => a + b, 0) / trainY.length).toFixed(1));

        // Trend direction
        let trend = 'stable';
        if (slope > 0.5) trend = 'increasing';
        else if (slope < -0.5) trend = 'decreasing';

        forecasts.push({
            product_id: parseInt(pid),
            product_name,
            avg_daily_demand: avgDaily,
            predicted_next_7_days_total: totalNext7,
            daily_forecasts: nextWeekPredictions,
            trend,
            slope: parseFloat(slope.toFixed(3)),
            mae: maeVal,
            rmse: rmseVal,
            data_points_used: days.length
        });
    }

    // Sort by predicted demand descending (highest demand first)
    forecasts.sort((a, b) => b.predicted_next_7_days_total - a.predicted_next_7_days_total);

    // Overall model metrics (average across all products)
    const avgMAE  = forecasts.length > 0
        ? parseFloat((forecasts.reduce((s, f) => s + f.mae, 0) / forecasts.length).toFixed(2))
        : 0;
    const avgRMSE = forecasts.length > 0
        ? parseFloat((forecasts.reduce((s, f) => s + f.rmse, 0) / forecasts.length).toFixed(2))
        : 0;

    return {
        forecasts,
        model: 'Simple Linear Regression',
        overall_mae: avgMAE,
        overall_rmse: avgRMSE,
        trained_on: rows.length,
        products_forecasted: forecasts.length,
        generated_at: new Date().toISOString()
    };
}

module.exports = { runDemandForecast };
