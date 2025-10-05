const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const express = require('express');

class CertbotUpdater {
    constructor() {
        this.domain = process.env.CERTBOT_DOMAIN || 'milsim.gato.click';
        this.email = process.env.CERTBOT_EMAIL || 'admin@milsim.gato.click';
        this.port = process.env.CERTBOT_PORT || 80;
        this.challengeDir = '/tmp/.well-known/acme-challenge';
        this.server = null;
    }

    // Check if certbot is installed
    checkCertbot() {
        try {
            execSync('which certbot', { stdio: 'pipe' });
            return true;
        } catch (error) {
            return false;
        }
    }

    // Create challenge directory
    createChallengeDir() {
        if (!fs.existsSync(this.challengeDir)) {
            fs.mkdirSync(this.challengeDir, { recursive: true });
            console.log(`Created challenge directory: ${this.challengeDir}`);
        }
    }

    // Start Express server for verification
    startVerificationServer() {
        return new Promise((resolve, reject) => {
            const app = express();

            // Serve ACME challenges
            app.use('/.well-known/acme-challenge', express.static(this.challengeDir));

            // Health check
            app.get('/health', (req, res) => {
                res.json({ status: 'ok', server: 'certbot-verification' });
            });

            this.server = app.listen(this.port, '0.0.0.0', (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                console.log(`Verification server running on port ${this.port}`);
                resolve();
            });
        });
    }

    // Stop verification server
    stopVerificationServer() {
        return new Promise((resolve) => {
            if (this.server) {
                this.server.close(() => {
                    console.log('Verification server stopped');
                    this.server = null;
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    // Check if certificates need renewal
    checkRenewalNeeded() {
        try {
            console.log('Checking if certificates need renewal...');
            execSync('certbot renew --dry-run', { stdio: 'inherit' });
            console.log('Certificates are up to date, no renewal needed.');
            return false;
        } catch (error) {
            console.log('Certificates need renewal or initial issuance.');
            return true;
        }
    }

    // Run certbot to install/update certificates
    runCertbot() {
        return new Promise((resolve, reject) => {
            console.log('Running certbot to install/update certificates...');
            
            const certbot = spawn('certbot', [
                'certonly',
                '--standalone',
                '--preferred-challenges', 'http',
                '--http-01-port', this.port.toString(),
                '--domain', this.domain,
                '--email', this.email,
                '--agree-tos',
                '--non-interactive',
                '--keep-until-expiring'
            ], { stdio: 'inherit' });

            certbot.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`Certbot failed with exit code: ${code}`));
                }
            });

            certbot.on('error', (error) => {
                reject(error);
            });
        });
    }

    // Main update method
    async update() {
        console.log(`Updating SSL certificates for domain: ${this.domain}`);
        console.log(`Email: ${this.email}`);
        console.log(`Verification port: ${this.port}`);

        // Check prerequisites
        if (!this.checkCertbot()) {
            throw new Error('certbot is not installed. Please install certbot first.');
        }

        // Check if renewal is needed
        if (!this.checkRenewalNeeded()) {
            return;
        }

        // Prepare for verification
        this.createChallengeDir();

        try {
            // Start verification server
            await this.startVerificationServer();

            // Wait a moment for server to be ready
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Run certbot
            await this.runCertbot();

            console.log(`✅ Certificates successfully updated for ${this.domain}`);
            console.log(`Certificate location: /etc/letsencrypt/live/${this.domain}/`);

            // List certificate files
            try {
                const certPath = `/etc/letsencrypt/live/${this.domain}`;
                const files = fs.readdirSync(certPath);
                console.log('Certificate files:');
                files.forEach(file => {
                    console.log(`  - ${file}`);
                });
            } catch (error) {
                console.log('Could not list certificate files:', error.message);
            }

        } finally {
            // Always stop the server
            await this.stopVerificationServer();
        }
    }
}

// Main execution
async function main() {
    const updater = new CertbotUpdater();
    
    try {
        await updater.update();
        process.exit(0);
    } catch (error) {
        console.error('❌ Certificate update failed:', error.message);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, shutting down...');
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('Received SIGINT, shutting down...');
    process.exit(0);
});

// Run if this file is executed directly
if (require.main === module) {
    main();
}

module.exports = CertbotUpdater;