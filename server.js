require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 3000;

// Use /tmp for read-only environments (like Vercel/Render free without disk) to avoid crash,
// though data will be temporary.
const DB_FILE = process.env.DB_PATH || path.join(__dirname, 'database.json');

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public')); // Serve static files from 'public' directory

// Helper to read/write database
const readDB = () => {
    if (!fs.existsSync(DB_FILE)) {
        // Initialize if missing
        return { users: [] };
    }
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
};

const writeDB = (data) => {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
};

// --- Endpoints ---

// 1. Register User
app.post('/api/register', async (req, res) => {
    try {
        const { fullName, bloodGroup, allergies, emergencyContact, conditions } = req.body;

        if (!fullName || !bloodGroup || !emergencyContact) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const id = uuidv4();
        const newUser = {
            id,
            fullName,
            bloodGroup,
            allergies: allergies || 'None',
            conditions: conditions || 'None',
            emergencyContact
        };

        const db = readDB();
        db.users.push(newUser);
        writeDB(db);

        // Generate QR Code URL (pointing to the view page)
        // Dynamically determine host (localhost or production domain)
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.headers.host;
        const viewUrl = `${protocol}://${host}/view.html?id=${id}`;

        const qrCodeDataUrl = await QRCode.toDataURL(viewUrl);

        res.json({
            success: true,
            id,
            qrCode: qrCodeDataUrl,
            viewUrl
        });

    } catch (error) {
        console.error('Registration Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 2. Get User Info (Public View)
app.get('/api/user/:id', (req, res) => {
    const { id } = req.params;
    const db = readDB();
    const user = db.users.find(u => u.id === id);

    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    // Return only public safety info
    res.json({
        fullName: user.fullName,
        bloodGroup: user.bloodGroup,
        allergies: user.allergies,
        conditions: user.conditions,
        emergencyContact: user.emergencyContact
    });
});

// 3. Mock SMS Notification
app.post('/api/notify', (req, res) => {
    const { id, latitude, longitude } = req.body;

    if (!id) {
        return res.status(400).json({ error: 'Missing User ID' });
    }

    const db = readDB();
    const user = db.users.find(u => u.id === id);

    if (user) {
        // Send Notification (WhatsApp/SMS via Twilio)

        let locationMsg = 'Location: Not provided (User blocked location or error).';
        let mapsLink = '';
        if (latitude && longitude) {
            mapsLink = `https://www.google.com/maps?q=${latitude},${longitude}`;
            locationMsg = `Location: ${mapsLink}`;
        }

        console.log(`[NOTIFY] Alerting ${user.emergencyContact} for ${user.fullName}`);

        if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
            try {
                const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

                // Use user provided number or fallback to sandbox number for 'For'
                const to = `whatsapp:${user.emergencyContact.replace(/\s+/g, '')}`;
                const from = `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`;

                client.messages.create({
                    body: `🚨 *Medi-Vault Emergency Alert* 🚨\n\nThe medical record for *${user.fullName}* was just scanned.\n\n${locationMsg}\n\nPlease contact them or emergency services if needed.`,
                    from: from,
                    to: to
                })
                    .then(message => console.log(`[TWILIO] Message sent: ${message.sid}`))
                    .catch(err => console.error(`[TWILIO ERROR] ${err.message}`));

                res.json({ success: true, message: 'Emergency alert sent via WhatsApp' });
            } catch (err) {
                console.error('[TWILIO INIT ERROR]', err);
                res.json({ success: false, message: 'Failed to initialize Twilio' });
            }
        } else {
            console.log('[MOCK NOTIFICATION] Twilio credentials missing. Printing to console:');
            console.log(`To: ${user.emergencyContact}`);
            console.log(`Msg: QR scanned for ${user.fullName}. ${locationMsg}`);
            res.json({ success: true, message: 'Emergency contact notified (Mocked - Set env vars for real)' });
        }
    } else {
        res.status(404).json({ error: 'User not found for notification' });
    }
});

app.listen(PORT, () => {
    console.log(`Medi-Vault Server running on http://localhost:${PORT}`);
});
