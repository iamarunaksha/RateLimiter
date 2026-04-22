const slidingWindowStore = {};

function slidingWindowRateLimiter(limit, windowMs) {

    return (req, res, next) => {

        const ip = req.ip;
        const now = Date.now();

        //Initialize windowStore map
        if(!slidingWindowStore[ip])
            slidingWindowStore[ip] = {timestamps : []};

        const log = slidingWindowStore[ip];
        const windowStart = now - windowMs;

        //Remove all older timestamps from map, which are older than windowStart
        log.timestamps = log.timestamps.filter(ts => ts > windowStart);             //ts > windowStart => if this returns true, then that timestamp stays in queue

        //Rate limt
        if(log.timestamps.length >= limit) {

            const msUntilNext = log.timestamps[0] - windowStart;

            res.setHeader('X-RateLimit-Limit', limit);
            res.setHeader('X-RateLimit-Remaining', 0);
            res.setHeader('Retry-After', Math.ceil(msUntilNext / 1000));

            return res.status(429).json({
                ok: false,
                status: 429,
                message: 'You have been rate limited. Please try again later.'
            });
        }

        //Allow request
        log.timestamps.push(now);
        res.setHeader('X-RateLimit-Limit', limit);
        res.setHeader('X-RateLimit-Remaining', limit - log.timestamps.length);
        next();
    }
}
// Peek at current state without logging a timestamp
function getSlidingWindowStatus(ip, limit, windowMs) {
    if (!slidingWindowStore[ip]) return { remaining: limit, limit };
    const log = slidingWindowStore[ip];
    const windowStart = Date.now() - windowMs;
    const validTimestamps = log.timestamps.filter(ts => ts > windowStart);
    return { remaining: Math.max(0, limit - validTimestamps.length), limit };
}

slidingWindowRateLimiter.getStatus = getSlidingWindowStatus;
module.exports = slidingWindowRateLimiter;