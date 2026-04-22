const client = require('../redisClient');

function tokenBucketRedisLimiter(capacity, refillAmount, refillEveryMs) {

    return async (req, res, next) => {

        const ip = req.ip;
        const now = Date.now();
        const key = 'tb:' + ip;

        // 1. Read this user's bucket data from Redis
        const data = await client.hGetAll(key);

        // 2. If empty object = new user. Initialize their bucket in Redis.
        if(Object.keys(data).length === 0) {

            await client.hSet(key, {
                tokens: String(capacity - 1),
                lastRefill: String(now)
            });

            res.setHeader('X-RateLimit-Limit', capacity);
            res.setHeader('X-RateLimit-Remaining', capacity - 1);
            return next();
        }

        // 3. Parse tokens and lastRefill from Redis (Redis stores everything as strings!)
        let tokens = parseFloat(data.tokens);
        let lastRefill = parseInt(data.lastRefill);

        // 4. Calculate refill based on elapsed time (same math as local version)
        const elapsed = now - lastRefill;
        const tokensToAdd = Math.floor(elapsed / refillEveryMs) * refillAmount;

        if(tokensToAdd > 0) {
            tokens = Math.min(capacity, tokens + tokensToAdd);
            lastRefill += tokensToAdd * refillEveryMs;
        }

        // 5. Check if bucket is empty — block the request
        if(tokens < 1) {
            
            const msUntilNext = refillEveryMs - (now - lastRefill);

            await client.hSet(key, {
                tokens: String(tokens),
                lastRefill: String(lastRefill)
            });

            res.setHeader('X-RateLimit-Limit', capacity);
            res.setHeader('X-RateLimit-Remaining', 0);
            res.setHeader('Retry-After', Math.ceil(msUntilNext / 1000));

            return res.status(429).json({
                ok: false,
                status: 429,
                message: 'You have been rate limited. Please try again later.'
            });
        }

        // 6. Allow the request — consume 1 token and save back to Redis
        tokens -= 1;

        await client.hSet(key, {
            tokens: String(tokens),
            lastRefill: String(lastRefill)
        });

        res.setHeader('X-RateLimit-Limit', capacity);
        res.setHeader('X-RateLimit-Remaining', tokens);
        next();
    };
}
// Peek at current state from Redis without consuming a token
async function getTokenBucketRedisStatus(ip, capacity, refillAmount, refillEveryMs) {
    const key = 'tb:' + ip;
    const data = await client.hGetAll(key);

    if (Object.keys(data).length === 0) return { remaining: capacity, limit: capacity };

    let tokens = parseFloat(data.tokens);
    let lastRefill = parseInt(data.lastRefill);
    const now = Date.now();
    const elapsed = now - lastRefill;
    const tokensToAdd = Math.floor(elapsed / refillEveryMs) * refillAmount;

    if (tokensToAdd > 0) {
        tokens = Math.min(capacity, tokens + tokensToAdd);
    }

    return { remaining: Math.max(0, Math.floor(tokens)), limit: capacity };
}

tokenBucketRedisLimiter.getStatus = getTokenBucketRedisStatus;
module.exports = tokenBucketRedisLimiter;