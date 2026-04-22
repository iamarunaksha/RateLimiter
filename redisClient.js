const redis = require('redis');
require('dotenv').config();    // Loads .env file into process.env

const client = redis.createClient({
    url: process.env.REDIS_URL
});

// Log connection events so we know what's happening
client.on('connect', () => console.log('Connected to Redis'));
client.on('error', (err) => console.log('Redis Error:', err));

// Connect! This is async (returns a Promise)
client.connect();

module.exports = client;