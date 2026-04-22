const tokenBucketStore = {};

function tokenBucketLimiter(capacity, refillAmount, refillEveryMs) {
  
  return (req, res, next) => {
    
    const ip = req.ip;
    const now = Date.now();

    // 1. Initialize bucket for new IPs
    if (!tokenBucketStore[ip]) {
      tokenBucketStore[ip] = { tokens: capacity, lastRefill: now };
    }

    const bucket = tokenBucketStore[ip];

    // 2. Calculate and apply refill based on elapsed time
    const elapsed = now - bucket.lastRefill;
    const tokensToAdd = Math.floor(elapsed / refillEveryMs) * refillAmount;

    if (tokensToAdd > 0) {
      bucket.tokens = Math.min(capacity, bucket.tokens + tokensToAdd);
      bucket.lastRefill += tokensToAdd * refillEveryMs; // carry forward partial time
    }

    // 3. Block if empty
    if (bucket.tokens < 1) {
      const msUntilNext = refillEveryMs - (now - bucket.lastRefill);

      res.setHeader('X-RateLimit-Limit', capacity);
      res.setHeader('X-RateLimit-Remaining', 0);
      res.setHeader('Retry-After', Math.ceil(msUntilNext / 1000));

      return res.status(429).json({
        ok: false,
        status: 429,
        message: 'You have been rate limited. Please try again later.'
      });
    }

    // 4. Allow: consume token
    bucket.tokens -= 1;
    res.setHeader('X-RateLimit-Limit', capacity);
    res.setHeader('X-RateLimit-Remaining', bucket.tokens);
    next();
  };
}
// Peek at current state without consuming a token
function getTokenBucketStatus(ip, capacity, refillAmount, refillEveryMs) {
    if (!tokenBucketStore[ip]) return { remaining: capacity, limit: capacity };
    const bucket = tokenBucketStore[ip];
    const now = Date.now();
    const elapsed = now - bucket.lastRefill;
    const tokensToAdd = Math.floor(elapsed / refillEveryMs) * refillAmount;
    const tokens = Math.min(capacity, bucket.tokens + tokensToAdd);
    return { remaining: Math.max(0, Math.floor(tokens)), limit: capacity };
}

tokenBucketLimiter.getStatus = getTokenBucketStatus;
module.exports = tokenBucketLimiter;