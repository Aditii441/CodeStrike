const { createClient }=require('redis');

const client = createClient({
    username: 'default',
    password: process.env.REDIS_PASS,
    socket: {
        host: 'considerate-hydrant-jadeish-36765.db.redis.io',
        port: 16470
    }
});

module.exports=client;







