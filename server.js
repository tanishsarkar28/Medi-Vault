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
        // MOCK SMS SENDING
        console.log(`[MOCK SMS] To: ${user.emergencyContact}`);
        console.log(`[MOCK SMS] Message: ALERT! The Medi-Vault QR code for ${user.fullName} was scanned.`);

        if (latitude && longitude) {
            console.log(`[MOCK SMS] Location: https://www.google.com/maps?q=${latitude},${longitude}`);
        } else {
            console.log(`[MOCK SMS] Location: Not provided (User blocked location or error).`);
        }

        res.json({ success: true, message: 'Emergency contact notified (Mocked)' });
    } else {
        res.status(404).json({ error: 'User not found for notification' });
    }
});

app.listen(PORT, () => {
    console.log(`Medi-Vault Server running on http://localhost:${PORT}`);
});
