/**
 * Isolation Forest — Anomaly Detection (Pure JavaScript, no external ML library)
 *
 * Spec compliance:
 *   - Student 1 (Haleema): "an abnormal detecting model (e.g., Isolation Forest) will be deployed
 *     to detect unusual stock flows like abrupt large-scale stock-out actions, frequent stock
 *     reorganizations of the same user, or unusual transaction rate"
 *   - Student 3 (Keerthana): "an anomaly detection model (e.g., Isolation Forest) will be
 *     introduced... The model will examine a frequency of transactions, variation in quantity,
 *     distribution of timestamps and pattern of user activity"
 *   - Evaluation: precision, recall, false positive rate as specified by Student 3
 *
 * How Isolation Forest works (simplified):
 *   - Build many random binary trees (isolation trees)
 *   - Anomalies are isolated (reach a leaf) in fewer splits than normal points
 *   - Anomaly score = average path length across all trees, normalised to 0–1
 *   - Score > threshold → anomalous
 *
 * Features used per transaction:
 *   1. quantity_zscore       — how many std deviations above average quantity
 *   2. daily_freq_zscore     — how busy was that day compared to average
 *   3. user_repeat_zscore    — how many times did same user transact that day
 *   4. hour_deviation        — distance from typical business hours (9–17)
 */

const db = require('../config/db');

// ── Isolation Tree Node ────────────────────────────────────────────────────
class IsolationTree {
    constructor(maxDepth) {
        this.maxDepth = maxDepth;
        this.root = null;
    }

    fit(data) {
        this.root = this._buildTree(data, 0);
    }

    _buildTree(data, depth) {
        if (data.length <= 1 || depth >= this.maxDepth) {
            return { isLeaf: true, size: data.length };
        }

        const featureCount = data[0].length;
        const featureIdx = Math.floor(Math.random() * featureCount);

        const values = data.map(d => d[featureIdx]);
        const min = Math.min(...values);
        const max = Math.max(...values);

        if (min === max) {
            return { isLeaf: true, size: data.length };
        }

        const splitVal = min + Math.random() * (max - min);
        const left  = data.filter(d => d[featureIdx] < splitVal);
        const right = data.filter(d => d[featureIdx] >= splitVal);

        return {
            isLeaf: false,
            featureIdx,
            splitVal,
            left:  this._buildTree(left,  depth + 1),
            right: this._buildTree(right, depth + 1),
        };
    }

    pathLength(point) {
        return this._pathLength(point, this.root, 0);
    }

    _pathLength(point, node, depth) {
        if (node.isLeaf) {
            return depth + this._c(node.size);
        }
        if (point[node.featureIdx] < node.splitVal) {
            return this._pathLength(point, node.left,  depth + 1);
        }
        return this._pathLength(point, node.right, depth + 1);
    }

    // Average path length for a BST with n nodes (normalisation factor)
    _c(n) {
        if (n <= 1) return 0;
        if (n === 2) return 1;
        return 2 * (Math.log(n - 1) + 0.5772156649) - (2 * (n - 1) / n);
    }
}

// ── Isolation Forest ──────────────────────────────────────────────────────
class IsolationForest {
    constructor(nTrees = 100, subsampleSize = 256) {
        this.nTrees = nTrees;
        this.subsampleSize = subsampleSize;
        this.trees = [];
    }

    fit(data) {
        this.trees = [];
        const maxDepth = Math.ceil(Math.log2(this.subsampleSize));
        for (let i = 0; i < this.nTrees; i++) {
            // Random subsample
            const sample = [];
            const size = Math.min(this.subsampleSize, data.length);
            const indices = new Set();
            while (indices.size < size) {
                indices.add(Math.floor(Math.random() * data.length));
            }
            indices.forEach(idx => sample.push(data[idx]));

            const tree = new IsolationTree(maxDepth);
            tree.fit(sample);
            this.trees.push(tree);
        }
        this._c_n = this._c(Math.min(this.subsampleSize, data.length));
    }

    _c(n) {
        if (n <= 1) return 0;
        if (n === 2) return 1;
        return 2 * (Math.log(n - 1) + 0.5772156649) - (2 * (n - 1) / n);
    }

    // Returns anomaly score 0–1. Score > 0.6 = anomalous
    score(point) {
        if (this.trees.length === 0) return 0;
        const avgPath = this.trees.reduce((sum, tree) => sum + tree.pathLength(point), 0) / this.trees.length;
        if (this._c_n === 0) return 0.5;
        return Math.pow(2, -avgPath / this._c_n);
    }
}

// ── Helper: z-score normalise an array ────────────────────────────────────
function zscoreNormalise(arr) {
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const variance = arr.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / arr.length;
    const std = Math.sqrt(variance) || 1;
    return arr.map(v => (v - mean) / std);
}

// ── Main Anomaly Detection Function ───────────────────────────────────────
async function runIsolationForest() {
    // Fetch all stock-out transactions
    const [rows] = await db.query(`
        SELECT s.request_id, s.product_id, p.name AS product_name,
               s.quantity, s.status, s.created_by, s.timestamp,
               u.name AS user_name
        FROM stock_out_requests s
        JOIN products p ON s.product_id = p.product_id
        LEFT JOIN users u ON s.created_by = u.user_id
        ORDER BY s.timestamp ASC
    `);

    if (rows.length < 10) {
        return {
            anomalies: [],
            all_scored: [],
            metrics: { precision: 0, recall: 0, false_positive_rate: 0 },
            model: 'Isolation Forest',
            note: 'Insufficient data (need at least 10 transactions)',
            generated_at: new Date().toISOString()
        };
    }

    // ── Feature Engineering ───────────────────────────────────────────────

    // Feature 1: Raw quantity
    const quantities = rows.map(r => r.quantity);

    // Feature 2: Daily transaction frequency per product
    const dailyProductFreq = {};
    rows.forEach(r => {
        const day = r.timestamp.toISOString ? r.timestamp.toISOString().split('T')[0]
                    : new Date(r.timestamp).toISOString().split('T')[0];
        const key = `${day}_${r.product_id}`;
        dailyProductFreq[key] = (dailyProductFreq[key] || 0) + 1;
    });
    const freqs = rows.map(r => {
        const day = new Date(r.timestamp).toISOString().split('T')[0];
        return dailyProductFreq[`${day}_${r.product_id}`];
    });

    // Feature 3: User repeat count per day
    const dailyUserCount = {};
    rows.forEach(r => {
        const day = new Date(r.timestamp).toISOString().split('T')[0];
        const key = `${day}_${r.created_by}`;
        dailyUserCount[key] = (dailyUserCount[key] || 0) + 1;
    });
    const userRepeats = rows.map(r => {
        const day = new Date(r.timestamp).toISOString().split('T')[0];
        return dailyUserCount[`${day}_${r.created_by}`] || 1;
    });

    // Feature 4: Hour deviation from business hours (9–17)
    const hourDeviations = rows.map(r => {
        const hour = new Date(r.timestamp).getHours();
        const midBusiness = 13; // centre of 9-17
        return Math.abs(hour - midBusiness);
    });

    // Z-score normalise all features
    const normQty      = zscoreNormalise(quantities);
    const normFreq     = zscoreNormalise(freqs);
    const normUser     = zscoreNormalise(userRepeats);
    const normHour     = zscoreNormalise(hourDeviations);

    // Build feature matrix
    const featureMatrix = rows.map((_, i) => [
        normQty[i],
        normFreq[i],
        normUser[i],
        normHour[i]
    ]);

    // ── Train Isolation Forest ────────────────────────────────────────────
    const forest = new IsolationForest(100, Math.min(256, featureMatrix.length));
    forest.fit(featureMatrix);

    // Score every transaction
    const THRESHOLD = 0.62;
    const scored = rows.map((r, i) => {
        const anomalyScore = parseFloat(forest.score(featureMatrix[i]).toFixed(4));
        return {
            request_id: r.request_id,
            product_name: r.product_name,
            product_id: r.product_id,
            quantity: r.quantity,
            status: r.status,
            user_name: r.user_name || 'Unknown',
            timestamp: r.timestamp,
            anomaly_score: anomalyScore,
            is_anomaly: anomalyScore > THRESHOLD,
            features: {
                quantity_zscore:    parseFloat(normQty[i].toFixed(3)),
                daily_freq_zscore:  parseFloat(normFreq[i].toFixed(3)),
                user_repeat_zscore: parseFloat(normUser[i].toFixed(3)),
                hour_deviation:     parseFloat(normHour[i].toFixed(3))
            }
        };
    });

    const anomalies = scored.filter(s => s.is_anomaly)
                            .sort((a, b) => b.anomaly_score - a.anomaly_score);

    // ── Evaluation Metrics ────────────────────────────────────────────────
    // Ground truth: quantity > mean + 2*std is a "true" anomaly
    const meanQty = quantities.reduce((a, b) => a + b, 0) / quantities.length;
    const stdQty  = Math.sqrt(quantities.reduce((acc, v) => acc + Math.pow(v - meanQty, 2), 0) / quantities.length);
    const trueAnomalyThreshold = meanQty + 2 * stdQty;

    const truePositives  = scored.filter(s => s.is_anomaly && s.quantity > trueAnomalyThreshold).length;
    const falsePositives = scored.filter(s => s.is_anomaly && s.quantity <= trueAnomalyThreshold).length;
    const falseNegatives = scored.filter(s => !s.is_anomaly && s.quantity > trueAnomalyThreshold).length;
    const trueNegatives  = scored.filter(s => !s.is_anomaly && s.quantity <= trueAnomalyThreshold).length;

    const precision = truePositives + falsePositives > 0
        ? parseFloat((truePositives / (truePositives + falsePositives)).toFixed(3)) : 0;
    const recall = truePositives + falseNegatives > 0
        ? parseFloat((truePositives / (truePositives + falseNegatives)).toFixed(3)) : 0;
    const falsePositiveRate = falsePositives + trueNegatives > 0
        ? parseFloat((falsePositives / (falsePositives + trueNegatives)).toFixed(3)) : 0;

    return {
        anomalies: anomalies.slice(0, 20), // top 20 anomalies
        total_anomalies: anomalies.length,
        total_transactions: rows.length,
        threshold_used: THRESHOLD,
        metrics: {
            precision,
            recall,
            false_positive_rate: falsePositiveRate,
            true_positives: truePositives,
            false_positives: falsePositives,
            false_negatives: falseNegatives,
            true_negatives: trueNegatives
        },
        model: 'Isolation Forest',
        features_used: ['quantity_zscore', 'daily_frequency_zscore', 'user_repeat_zscore', 'hour_deviation'],
        generated_at: new Date().toISOString()
    };
}

module.exports = { runIsolationForest };
