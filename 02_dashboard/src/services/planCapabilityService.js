import { resolveDashboardDataPath } from '../utils.js';

const CAPABILITIES_PATH = 'core/plan-capabilities.json';
const CACHE_KEY = 'planCapabilitiesCache';
const CACHE_VERSION_KEY = 'planCapabilitiesCacheVersion';

let capabilityCache = null;
let loadPromise = null;
const planChangeListeners = new Set();

function safeParse(jsonString) {
    if (!jsonString) return null;
    try {
        return JSON.parse(jsonString);
    } catch (error) {
        console.warn('Failed to parse cached plan capabilities.', error);
        return null;
    }
}

function normalizePlanTier(rawPlan) {
    if (!rawPlan) return 'free';
    const value = String(rawPlan).toLowerCase();
    if (value.includes('premiumplus') || value.includes('premium_plus') || value.includes('enterprise')) {
        return 'premiumPlus';
    }
    if (value.includes('premium')) return 'premium';
    if (value.includes('standard')) return 'standard';
    if (value.includes('free')) return 'free';
    return 'free';
}

async function fetchCapabilities() {
    const response = await fetch(resolveDashboardDataPath(CAPABILITIES_PATH), {
        cache: 'no-store'
    });
    if (!response.ok) {
        throw new Error(`Failed to load plan capabilities: ${response.status}`);
    }
    const data = await response.json();
    const version = response.headers.get('etag') || new Date().toISOString();
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(data));
        localStorage.setItem(CACHE_VERSION_KEY, version);
    } catch (storageError) {
        console.warn('Failed to persist plan capability cache.', storageError);
    }
    return data;
}

async function loadPlanCapabilities() {
    if (capabilityCache) return capabilityCache;
    if (loadPromise) return loadPromise;

    loadPromise = fetchCapabilities()
        .then((data) => {
            capabilityCache = data;
            return data;
        })
        .catch((error) => {
            const cached = safeParse(localStorage.getItem(CACHE_KEY));
            if (cached) {
                capabilityCache = cached;
                return cached;
            }
            throw error;
        })
        .finally(() => {
            loadPromise = null;
        });

    return loadPromise;
}

function getCapabilitiesForTier(planTier, capabilities) {
    const tier = normalizePlanTier(planTier);
    return capabilities?.[tier] || capabilities?.free || {};
}

function getNestedValue(obj, path) {
    if (!path) return undefined;
    const keys = path.split('.');
    let current = obj;
    for (const key of keys) {
        if (!current || typeof current !== 'object') return undefined;
        current = current[key];
    }
    return current;
}

async function hasFeature(planTier, featureKey) {
    const capabilities = await loadPlanCapabilities();
    const plan = getCapabilitiesForTier(planTier, capabilities);
    const direct = plan.features?.[featureKey];
    if (typeof direct === 'boolean') return direct;
    const nested = getNestedValue(plan, featureKey);
    return Boolean(nested);
}

async function getLimit(planTier, limitKey) {
    const capabilities = await loadPlanCapabilities();
    const plan = getCapabilitiesForTier(planTier, capabilities);
    const limit = plan.limits?.[limitKey];
    if (limit !== undefined) return limit;
    const nested = getNestedValue(plan, limitKey);
    return nested;
}

async function listAllowedValues(planTier, categoryKey) {
    const capabilities = await loadPlanCapabilities();
    const plan = getCapabilitiesForTier(planTier, capabilities);
    const values = getNestedValue(plan, categoryKey);
    return Array.isArray(values) ? values : [];
}

async function assertLimit(planTier, limitKey, value) {
    const limit = await getLimit(planTier, limitKey);
    if (limit === null || limit === undefined) return { ok: true };
    if (typeof limit === 'number' && typeof value === 'number' && value > limit) {
        return { ok: false, limit, value };
    }
    return { ok: true };
}

function observePlanChange(callback) {
    if (typeof callback !== 'function') return () => {};
    planChangeListeners.add(callback);
    return () => planChangeListeners.delete(callback);
}

function notifyPlanChange(planTier) {
    planChangeListeners.forEach((listener) => {
        try {
            listener(planTier);
        } catch (error) {
            console.warn('Plan change listener failed.', error);
        }
    });
}

function getCachedCapabilitiesVersion() {
    return localStorage.getItem(CACHE_VERSION_KEY);
}

export {
    loadPlanCapabilities,
    normalizePlanTier,
    getCapabilitiesForTier,
    hasFeature,
    getLimit,
    listAllowedValues,
    assertLimit,
    observePlanChange,
    notifyPlanChange,
    getCachedCapabilitiesVersion
};
