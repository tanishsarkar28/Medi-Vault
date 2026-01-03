document.getElementById('registerForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const submitBtn = document.getElementById('submitBtn');
    submitBtn.textContent = 'Generating...';
    submitBtn.disabled = true;

    const formData = {
        fullName: document.getElementById('fullName').value,
        bloodGroup: document.getElementById('bloodGroup').value,
        emergencyContact: document.getElementById('emergencyContact').value,
        allergies: document.getElementById('allergies').value,
        conditions: document.getElementById('conditions').value
    };

    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (data.success) {
            // Hide form, show QR
            document.getElementById('registration-card').style.display = 'none';
            const qrCard = document.getElementById('qr-card');
            qrCard.style.display = 'block';
            qrCard.classList.add('animate-fade-in');

            // Set QR Image
            const qrImage = document.getElementById('qrImage');
            qrImage.src = data.qrCode;

            // Setup download link
            const downloadLink = document.getElementById('downloadLink');
            downloadLink.href = data.qrCode;
        } else {
            alert('Error: ' + (data.error || 'Registration failed'));
            submitBtn.disabled = false;
            submitBtn.textContent = 'Generate QR Code';
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Network error occurred.');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Generate QR Code';
    }
});
