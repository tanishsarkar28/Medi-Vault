const urlParams = new URLSearchParams(window.location.search);
const userId = urlParams.get('id');

const loadingDiv = document.getElementById('loading');
const errorDiv = document.getElementById('error');
const errorMsg = document.getElementById('errorMsg');
const infoCard = document.getElementById('info-card');
const locationStatus = document.getElementById('locationStatus');

// 1. Fetch User Data
async function loadUserData() {
    if (!userId) {
        showError('No User ID provided.');
        return;
    }

    try {
        const response = await fetch(`/api/user/${userId}`);

        if (!response.ok) {
            throw new Error('User not found');
        }

        const user = await response.json();

        // Populate UI
        document.getElementById('userName').textContent = user.fullName;
        document.getElementById('bloodGroup').textContent = user.bloodGroup;
        document.getElementById('allergies').textContent = user.allergies;
        document.getElementById('conditions').textContent = user.conditions;

        const callBtn = document.getElementById('callBtn');
        callBtn.href = `tel:${user.emergencyContact}`;
        callBtn.innerHTML = `📞 Call ${user.emergencyContact}`;

        loadingDiv.style.display = 'none';
        infoCard.style.display = 'block';

        // 2. Trigger Notification (after data load)
        triggerNotification();

    } catch (err) {
        showError(err.message);
    }
}

function showError(msg) {
    loadingDiv.style.display = 'none';
    infoCard.style.display = 'none';
    errorDiv.style.display = 'block';
    errorMsg.textContent = msg;
}

// 3. Location & Notification Logic
// 3. Location & Notification Logic
function triggerNotification() {
    if (!navigator.geolocation) {
        locationStatus.textContent = '❌ Location not supported by browser.';
        sendNotification(null, null);
        return;
    }

    locationStatus.textContent = '⏳ Acquiring precise location...';

    const highAccuracyOptions = { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 };

    // Attempt 1: High Accuracy (GPS)
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            locationStatus.innerHTML = '✅ Location acquired (GPS).<br>Sending alert...';
            sendNotification(latitude, longitude);
        },
        (error) => {
            console.warn('GPS failed, trying low accuracy...', error);
            locationStatus.textContent = '⚠️ GPS weak/blocked. Trying network location...';

            // Attempt 2: Low Accuracy (Wi-Fi/Cell)
            const lowAccuracyOptions = { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 };

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    locationStatus.innerHTML = '✅ Location acquired (Network).<br>Sending alert...';
                    sendNotification(latitude, longitude);
                },
                (finalError) => {
                    handleLocationError(finalError);
                },
                lowAccuracyOptions
            );
        },
        highAccuracyOptions
    );
}

function handleLocationError(error) {
    let msg = 'Unknown error';
    let hint = '';

    switch (error.code) {
        case error.PERMISSION_DENIED:
            msg = 'Permission Denied';
            hint = 'Please allow location access in your browser settings.';
            break;
        case error.POSITION_UNAVAILABLE:
            msg = 'Position Unavailable';
            hint = 'Device cannot interpret location signals.';
            break;
        case error.TIMEOUT:
            msg = 'Timeout';
            hint = 'Location request took too long.';
            break;
    }

    // Critical Check for Mobile Testing over LAN
    if (window.isSecureContext === false) {
        msg = 'INSECURE CONNECTION';
        hint = '<b>CRITICAL:</b> Browsers BLOCK location on "http://" (except localhost).<br>To test on phone, you must deploy to a secure host (Render/Vercel) or use ngrok.';
    }

    locationStatus.innerHTML = `
        <div style="color: #ff4757; border: 1px solid #ff4757; padding: 10px; border-radius: 8px; margin-top: 10px; background: rgba(255, 71, 87, 0.1);">
            <strong>⚠️ LOCATION FAILED</strong><br>
            Reason: ${msg}<br>
            <small>${hint}</small>
        </div>
        <div style="margin-top:5px; font-size:0.8em; color: var(--text-muted);">Sending alert without location...</div>
    `;
    console.error('Final Geolocation error:', error);

    // Send notification without location
    sendNotification(null, null);
}

async function sendNotification(latitude, longitude) {
    try {
        locationStatus.innerHTML += ' <span style="color:var(--text-muted)">(Requesting server...)</span>';

        const response = await fetch('/api/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: userId,
                latitude,
                longitude
            })
        });

        const result = await response.json();

        if (result.success) {
            locationStatus.innerHTML = '✅ <b>Emergency Alert Sent!</b><br>Family has been notified.';
            locationStatus.style.color = 'var(--success)'; // Green
            console.log('Notification sent successfully');
        } else {
            throw new Error(result.message || 'Server error');
        }
    } catch (e) {
        console.error('Failed to send notification', e);
        locationStatus.innerHTML = `❌ <b>Alert Failed</b><br>Error: ${e.message}.<br><a href="tel:${document.getElementById('callBtn').href}">Please Call Manually</a>`;
        locationStatus.style.color = '#ff4757'; // Red
    }
}

// Start
loadUserData();
