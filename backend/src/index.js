const dns = require('node:dns');
dns.setServers(['1.1.1.1', '1.0.0.1']);
require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const main = require('./config/db');
const redisClient = require('./config/redis');
const authRouter = require('./routes/userAuth');
const problemRouter = require('./routes/problemCreator');
const submitRouter = require('./routes/submit');
const videoRouter = require('./routes/videoCreator');
const aiRouter = require('./routes/aiChatting');

const app = express();
// Enable only when the hosting provider confirms the trusted proxy hop count.
const proxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);
if (!Number.isSafeInteger(proxyHops) || proxyHops < 0) throw new Error('Invalid TRUST_PROXY_HOPS');
app.set('trust proxy', proxyHops || false);
app.use(cors({
    origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
    credentials: true
}));
app.use(express.json({limit: "2mb"}));
app.use(cookieParser());
app.use((req,res,next) => {
    const origin = req.get('Origin');
    if (!['GET','HEAD','OPTIONS'].includes(req.method) && origin && origin !== (process.env.FRONTEND_ORIGIN || 'http://localhost:5173')) return res.status(403).send('Origin not allowed');
    next();
});
app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/user', authRouter);
app.use('/problem', problemRouter);
app.use('/submission', submitRouter);
app.use('/video', videoRouter);
app.use('/ai', aiRouter);

async function initializeConnection() {
    const required = ['DB_STRING', 'JWT_KEY'];
    required.push('REDIS_PASS');
    const missing = required.filter(key => !process.env[key]?.trim());
    if (missing.length) throw new Error(`Missing environment variables: ${missing.join(', ')}`);

    const sameSite = process.env.COOKIE_SAME_SITE || 'lax';
    if (!['lax', 'strict', 'none'].includes(sameSite)) throw new Error('Invalid COOKIE_SAME_SITE');

    const port = Number(process.env.PORT || 3000);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');

    await Promise.all([main(), redisClient.connect()]);

    const server = app.listen(port, () => console.log(`Server listening on port ${port}`));
    server.on('error', error => {
        console.error('Unable to listen:', error.code);
        process.exit(1);
    });
}

if (require.main === module) {
    initializeConnection().catch(error => {
        console.error('Backend startup failed:', error.message);
        process.exit(1);
    });
}

module.exports = app;
