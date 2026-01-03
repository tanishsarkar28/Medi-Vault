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

// 3. Notification Logic (Location Disabled)
function triggerNotification() {
    locationStatus.textContent = '⏳ Sending emergency alert...';
    // Send notification immediately without location
    sendNotification(null, null);
}



// Start
loadUserData();
