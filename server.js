const express = require('express');
const path = require('path');
const config = require('./config.json');
const fixedWindowLimiter = require('./middlewares/fixedWindow');
const slidingWindowRateLimiter = require('./middlewares/slidingWindow');
const tokenBucketLimiter = require('./middlewares/tokenBucket');
const tokenBucketRedisLimiter = require('./middlewares/tokenBucketRedis');

const app = express();
const port = 3000;

app.use(express.json());

// Serve the frontend dashboard from the /public folder
app.use(express.static(path.join(__dirname, 'public')));

// Test GET route to test that things are working.
app.get('/api/test', (req, res) => {
    res.json({ ok: true, message: 'API Running OK', ip: req.ip });
});

// Status endpoint — peeks at current state without consuming requests
app.get('/api/status', async (req, res) => {
    const ip = req.ip;
    const fw = fixedWindowLimiter.getStatus(ip, config.fixedWindowRateLimit.limit, config.fixedWindowRateLimit.windowTimeMs);
    const tb = tokenBucketLimiter.getStatus(ip, config.tokenBucket.capacity, config.tokenBucket.refillAmount, config.tokenBucket.refillAfterMs);
    const sw = slidingWindowRateLimiter.getStatus(ip, config.slidingWindowRateLimit.limit, config.slidingWindowRateLimit.windowTimeMs);
    const redis = await tokenBucketRedisLimiter.getStatus(ip, config.tokenBucketRedis.capacity, config.tokenBucketRedis.refillAmount, config.tokenBucketRedis.refillAfterMs);

    res.json({ fw, tb, sw, redis });
});

// Configure the route using parameters dynamically sourced from config.json
app.get('/api/fixed-window',
    
    fixedWindowLimiter(config.fixedWindowRateLimit.limit, config.fixedWindowRateLimit.windowTimeMs),
    (req, res) => {
        res.json({ ok: true, algorithm: 'Fixed Window' });
    }
);

app.get('/api/sliding-window',
    
    slidingWindowRateLimiter(config.slidingWindowRateLimit.limit, config.slidingWindowRateLimit.windowTimeMs),
    (req, res) => {
        res.json({ ok: true, algorithm: 'Sliding Window' });
    }
);

app.get('/api/token-bucket',
    
    tokenBucketLimiter(config.tokenBucket.capacity, config.tokenBucket.refillAmount, config.tokenBucket.refillAfterMs),
    (req, res) => {
        res.json({ ok: true, algorithm: 'Token Bucket' });
    }
);

app.get('/api/token-bucket-redis',
    tokenBucketRedisLimiter(config.tokenBucketRedis.capacity, config.tokenBucketRedis.refillAmount, config.tokenBucketRedis.refillAfterMs),
    (req, res) => {
        res.json({ ok: true, algorithm: 'Token Bucket (Redis)' });
    }
);

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});