const fs = require('node:fs');
const crypto = require('node:crypto');

const mode = process.argv[2];
const secret = process.env.AESKEY;
const database = 'db/garmin.db';
const cache = '.garmin-state.enc';

if (!secret || secret.length < 32) {
    throw new Error('Set repository secret AESKEY to a random string of at least 32 characters.');
}

if (mode === 'save') {
    if (!fs.existsSync(database)) {
        console.log('No Garmin state to save.');
        process.exit(0);
    }
    const salt = crypto.randomBytes(16);
    const iv = crypto.randomBytes(12);
    const key = crypto.scryptSync(secret, salt, 32);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(fs.readFileSync(database)), cipher.final()]);
    fs.writeFileSync(cache, Buffer.concat([salt, iv, cipher.getAuthTag(), encrypted]), { mode: 0o600 });
    console.log('Encrypted Garmin state ready for cache.');
} else if (mode === 'restore') {
    if (!fs.existsSync(cache)) {
        console.log('No cached state. This run will sign in using repository secrets.');
        process.exit(0);
    }
    try {
        const encrypted = fs.readFileSync(cache);
        const key = crypto.scryptSync(secret, encrypted.subarray(0, 16), 32);
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, encrypted.subarray(16, 28));
        decipher.setAuthTag(encrypted.subarray(28, 44));
        const data = Buffer.concat([decipher.update(encrypted.subarray(44)), decipher.final()]);
        if (data.subarray(0, 16).toString() !== 'SQLite format 3\0') {
            throw new Error('Invalid database');
        }
        fs.mkdirSync('db', { recursive: true });
        fs.writeFileSync(database, data, { mode: 0o600 });
        console.log('Garmin state restored.');
    } catch {
        throw new Error('Cannot decrypt Garmin cache. If AESKEY changed, delete old caches in Actions > Caches and rerun.');
    }
} else {
    throw new Error('State mode must be restore or save.');
}
