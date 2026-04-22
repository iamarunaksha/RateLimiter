const fixedWindowStore = {};        //{key, value} -> {ip, {count, windowStart}}

function fixedWindowLimiter(limit, windowTime) {
    
    return (req, res, next) => {

        const ip = req.ip;
        const time = Date.now();

        // 1. If it's a completely new IP, initialize their state
        if(!fixedWindowStore[ip]) {
            
            fixedWindowStore[ip] = { count: 1, windowStart: time };
            
            res.setHeader('X-RateLimit-Limit', limit);
            res.setHeader('X-RateLimit-Remaining', limit - 1);
            
            return next();  //Allow the request
        }

        const userData = fixedWindowStore[ip];
        const timePassed = time - userData.windowStart;

        // 2. Check expiration first
        // If the elapsed time is greater than the window size, reset the bucket entirely.
        if(timePassed > windowTime) {
            
            userData.count = 1;
            userData.windowStart = time;
            
            res.setHeader('X-RateLimit-Limit', limit);
            res.setHeader('X-RateLimit-Remaining', limit - 1);
            
            return next();
        }

        // 3. This means present inside the active window. Check if limit is reached.
        if(userData.count < limit) {
            
            userData.count += 1;        //Increase count by 1 for this req
            
            res.setHeader('X-RateLimit-Limit', limit);
            res.setHeader('X-RateLimit-Remaining', limit - userData.count);
            
            return next();
        }

        // 4. This means present inside the window AND hit the limit. So, block it.
        res.setHeader('X-RateLimit-Limit', limit);
        res.setHeader('X-RateLimit-Remaining', 0);
        res.setHeader('Retry-After', Math.ceil((windowTime - timePassed) / 1000));
        
        return res.status(429).json({
            ok: false,
            status: 429,
            message: 'You have been rate limited. Please try again later.'
        });
    };
}
// Peek at current state without consuming a request
function getFixedWindowStatus(ip, limit, windowTime) {
    if (!fixedWindowStore[ip]) return { remaining: limit, limit };
    const userData = fixedWindowStore[ip];
    const timePassed = Date.now() - userData.windowStart;
    if (timePassed > windowTime) return { remaining: limit, limit };
    return { remaining: Math.max(0, limit - userData.count), limit };
}

fixedWindowLimiter.getStatus = getFixedWindowStatus;
module.exports = fixedWindowLimiter;