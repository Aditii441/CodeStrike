const { createClient } = require('redis');
const client = createClient({username: 'default', password: process.env.REDIS_PASS, socket: {host: 'velveteen-sesame-camera-56714.db.redis.io', port: 11476}});
client.on('error', error => console.error('Redis connection error:', error.code || error.name));
module.exports = client;
