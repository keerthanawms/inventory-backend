/**
 * Location Utilisation Intelligence (Pure JavaScript)
 *
 * Spec compliance:
 *   - Student 2 (Pradesh): "a lightweight machine learning model will be used to test the
 *     allocation data and retrieval data of the simulated data to determine the frequency
 *     of locations and also the underutilised or overloaded storage areas"
 *   - "The system will create smart alerts whenever certain areas reach certain utilisation limits"
 *   - "Accuracy of high-use and low-use zones classification will be used to evaluate
 *     the intelligent utilisation model"
 *
 * How it works:
 *   1. For each location, computes 3 raw features:
 *      a. product_count        — how many products are assigned there
 *      b. total_stock_volume   — total inventory quantity across all products in location
 *      c. retrieval_frequency  — how many stock-out approvals involved products in this location
 *   2. Min-max normalises each feature to 0–1
 *   3. Weighted composite score = 0.4*product_count + 0.35*stock_volume + 0.25*retrieval_freq
 *   4. Score * 100 → utilisation percentage
 *   5. Classification: < 20 = underutilised, 20–79 = normal, ≥ 80 = overloaded
 *   6. Smart alert generated for underutilised and overloaded locations
 *   7. Evaluation: classification accuracy against mean-based ground truth
 */

const db = require('../config/db');

// ── Min-Max Normalisation ──────────────────────────────────────────────────
function minMaxNormalise(arr) {
    const min = Math.min(...arr);
    const max = Math.max(...arr);
    if (max === min) return arr.map(() => 0.5);
    return arr.map(v => (v - min) / (max - min));
}

// ── Classify utilisation score ─────────────────────────────────────────────
function classify(score) {
    if (score < 20) return 'underutilised';
    if (score >= 80) return 'overloaded';
    return 'normal';
}

// ── Main Utilisation Function ──────────────────────────────────────────────
async function runLocationUtilisation() {
    // Get all locations
    const [locations] = await db.query('SELECT * FROM locations');
    if (locations.length === 0) {
        return {
            locations: [],
            alerts: [],
            summary: { total: 0, overloaded: 0, normal: 0, underutilised: 0 },
            model: 'Weighted Feature Scoring with Min-Max Normalisation',
            generated_at: new Date().toISOString()
        };
    }

    // Feature 1: Product count per location
    const [productCounts] = await db.query(`
        SELECT pl.location_id, COUNT(DISTINCT pl.product_id) AS product_count
        FROM product_locations pl
        GROUP BY pl.location_id
    `);
    const productCountMap = {};
    productCounts.forEach(r => { productCountMap[r.location_id] = r.product_count; });

    // Feature 2: Total stock volume per location
    const [stockVolumes] = await db.query(`
        SELECT pl.location_id, COALESCE(SUM(i.quantity), 0) AS total_stock
        FROM product_locations pl
        LEFT JOIN inventory i ON pl.product_id = i.product_id
        GROUP BY pl.location_id
    `);
    const stockVolumeMap = {};
    stockVolumes.forEach(r => { stockVolumeMap[r.location_id] = parseInt(r.total_stock); });

    // Feature 3: Retrieval frequency — stock-out approvals for products in each location
    const [retrievals] = await db.query(`
        SELECT pl.location_id, COUNT(*) AS retrieval_count
        FROM product_locations pl
        JOIN stock_out_requests s ON pl.product_id = s.product_id
        WHERE s.status = 'approved'
        GROUP BY pl.location_id
    `);
    const retrievalMap = {};
    retrievals.forEach(r => { retrievalMap[r.location_id] = r.retrieval_count; });

    // Build raw feature arrays in location order
    const locIds        = locations.map(l => l.location_id);
    const rawProducts   = locIds.map(id => productCountMap[id]  || 0);
    const rawStock      = locIds.map(id => stockVolumeMap[id]   || 0);
    const rawRetrieval  = locIds.map(id => retrievalMap[id]     || 0);

    // Normalise features
    const normProducts  = minMaxNormalise(rawProducts);
    const normStock     = minMaxNormalise(rawStock);
    const normRetrieval = minMaxNormalise(rawRetrieval);

    // Compute weighted composite score
    const WEIGHT_PRODUCTS  = 0.40;
    const WEIGHT_STOCK     = 0.35;
    const WEIGHT_RETRIEVAL = 0.25;

    const results = locations.map((loc, i) => {
        const compositeScore = (
            WEIGHT_PRODUCTS  * normProducts[i] +
            WEIGHT_STOCK     * normStock[i] +
            WEIGHT_RETRIEVAL * normRetrieval[i]
        );
        const utilisationPct = parseFloat((compositeScore * 100).toFixed(1));
        const classification = classify(utilisationPct);

        let alert = null;
        if (classification === 'overloaded') {
            alert = {
                severity: 'high',
                message: `Zone ${loc.zone}-${loc.section}-${loc.rack} is OVERLOADED with ${rawProducts[i]} products (${rawStock[i]} total units). Consider redistributing stock.`
            };
        } else if (classification === 'underutilised') {
            alert = {
                severity: 'low',
                message: `Zone ${loc.zone}-${loc.section}-${loc.rack} is UNDERUTILISED (${rawProducts[i]} products, ${rawStock[i]} units). Consider consolidating or reassigning.`
            };
        }

        return {
            location_id: loc.location_id,
            zone: loc.zone,
            section: loc.section,
            rack: loc.rack,
            label: `${loc.zone}-${loc.section}-${loc.rack}`,
            features: {
                product_count:       rawProducts[i],
                total_stock_volume:  rawStock[i],
                retrieval_frequency: rawRetrieval[i]
            },
            normalised_features: {
                product_count:       parseFloat(normProducts[i].toFixed(3)),
                stock_volume:        parseFloat(normStock[i].toFixed(3)),
                retrieval_frequency: parseFloat(normRetrieval[i].toFixed(3))
            },
            utilisation_score: utilisationPct,
            classification,
            alert
        };
    });

    // Sort by utilisation score descending
    results.sort((a, b) => b.utilisation_score - a.utilisation_score);

    // ── Evaluation: Classification Accuracy ───────────────────────────────
    // Ground truth: product_count > mean product_count → "high use", else "low use"
    const meanProducts = rawProducts.reduce((a, b) => a + b, 0) / rawProducts.length;
    const groundTruth  = rawProducts.map(p => p > meanProducts ? 'high' : 'low');
    const predicted    = results.map(r =>
        r.classification === 'overloaded' || r.classification === 'normal' ? 'high' : 'low'
    );

    // Re-align ground truth to match sorted results order
    const sortedGroundTruth = results.map(r => {
        const origIdx = locIds.indexOf(r.location_id);
        return groundTruth[origIdx];
    });

    const correct = predicted.filter((p, i) => p === sortedGroundTruth[i]).length;
    const classificationAccuracy = parseFloat((correct / predicted.length).toFixed(3));

    // Summary
    const overloaded    = results.filter(r => r.classification === 'overloaded').length;
    const underutilised = results.filter(r => r.classification === 'underutilised').length;
    const normal        = results.filter(r => r.classification === 'normal').length;
    const alerts        = results.filter(r => r.alert !== null).map(r => r.alert);

    return {
        locations: results,
        alerts,
        summary: {
            total: results.length,
            overloaded,
            normal,
            underutilised,
            classification_accuracy: classificationAccuracy
        },
        model: 'Weighted Feature Scoring (Min-Max Normalised)',
        weights: {
            product_count:       WEIGHT_PRODUCTS,
            stock_volume:        WEIGHT_STOCK,
            retrieval_frequency: WEIGHT_RETRIEVAL
        },
        evaluation: {
            classification_accuracy: classificationAccuracy,
            correct_classifications: correct,
            total_locations: results.length,
            method: 'Mean-threshold ground truth (product count > mean → high-use)'
        },
        generated_at: new Date().toISOString()
    };
}

module.exports = { runLocationUtilisation };
