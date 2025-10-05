const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 80;
const challengeDir = process.env.CHALLENGE_DIR || '/tmp/.well-known/acme-challenge';

// Create challenge directory if it doesn't exist
if (!fs.existsSync(challengeDir)) {
    fs.mkdirSync(challengeDir, { recursive: true });
    console.log(`Created challenge directory: ${challengeDir}`);
}

// Serve ACME challenges from the specified directory
app.use('/.well-known/acme-challenge', express.static(challengeDir));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        server: 'certbot-verification',
        port: port,
        challengeDir: challengeDir,
        timestamp: new Date().toISOString()
    });
});

// List available challenges
app.get('/challenges', (req, res) => {
    try {
        const files = fs.readdirSync(challengeDir);
        res.json({
            challengeDir: challengeDir,
            files: files,
            count: files.length
        });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to read challenge directory',
            message: error.message
        });
    }
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'Certbot Verification Server',
        endpoints: {
            health: '/health',
            challenges: '/challenges',
            acmeChallenge: '/.well-known/acme-challenge/{token}'
        },
        usage: 'This server is used for SSL certificate verification with Certbot'
    });
});

// Start server
const server = app.listen(port, '0.0.0.0', () => {
    console.log(`Certbot verification server running on port ${port}`);
    console.log(`Challenge directory: ${challengeDir}`);
    console.log(`Health check: http://localhost:${port}/health`);
});

// Handle graceful shutdown
const gracefulShutdown = (signal) => {
    console.log(`\nReceived ${signal}, shutting down gracefully...`);
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
    
    // Force close after 5 seconds
    setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 5000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});