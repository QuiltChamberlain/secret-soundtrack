document.addEventListener('DOMContentLoaded', () => {
    // Basic navigation active state for tool buttons
    const toolBtns = document.querySelectorAll('.tool-btn');
    toolBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            toolBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    const waitlistForm = document.getElementById('waitlist-form');
    const emailInput = document.getElementById('waitlist-email');
    const dlStatus = document.getElementById('download-status');
    const dlTitle = document.getElementById('dl-title');
    const dlProgress = document.getElementById('dl-progress');
    const dlText = document.getElementById('dl-text');
    const resultsList = document.getElementById('results-list');
    const testAnimBtn = document.getElementById('test-animation-btn');

    // Simulate finding a peer and downloading the ticket
    function runDownloadSimulation(ticketNum) {
        dlStatus.classList.remove('hidden');
        dlTitle.textContent = "Connecting to peer...";
        dlProgress.style.width = "0%";
        dlText.textContent = "Negotiating connection...";

        let progress = 0;
        const totalSize = 4280; // KB
        
        setTimeout(() => {
            dlTitle.textContent = `Downloading: TICKET_${ticketNum}.mp3`;
            const interval = setInterval(() => {
                progress += Math.floor(Math.random() * 500) + 100;
                if (progress >= totalSize) progress = totalSize;
                
                const percent = Math.floor((progress / totalSize) * 100);
                dlProgress.style.width = percent + "%";
                dlText.textContent = `${progress} KB / ${totalSize} KB (${percent}%)`;
                
                if (progress >= totalSize) {
                    clearInterval(interval);
                    dlTitle.textContent = "Download Complete!";
                    dlText.textContent = "File saved to My Shared Folder";
                    
                    // Add result to the list to show success
                    const newRow = document.createElement('div');
                    newRow.className = 'result-row highlight';
                    newRow.innerHTML = `
                        <div class="col-filename">TICKET_${ticketNum}.mp3</div>
                        <div class="col-size">4,280 KB</div>
                        <div class="col-bitrate">128</div>
                        <div class="col-freq">44100</div>
                        <div class="col-length">4:20</div>
                        <div class="col-user">secret_soundtrack</div>
                        <div class="col-conn">Cable</div>
                        <div class="col-ping green">12</div>
                    `;
                    resultsList.prepend(newRow);
                    
                    setTimeout(() => {
                        dlStatus.classList.add('hidden');
                        emailInput.value = '';
                    }, 2000);
                }
            }, 300);
        }, 1000);
    }

    // Test Animation
    if (testAnimBtn) {
        testAnimBtn.addEventListener('click', () => {
            const ticketNum = Math.floor(10000000 + Math.random() * 90000000);
            runDownloadSimulation(ticketNum);
        });
    }

    // Initialize Firebase
    fetch('/__/firebase/init.json').then(async response => {
        const config = await response.json();
        firebase.initializeApp(config);
        const db = firebase.firestore();

        if (waitlistForm) {
            waitlistForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const submitBtn = document.getElementById('waitlist-submit');
                submitBtn.disabled = true;

                const email = emailInput.value;
                const playlist = document.getElementById('waitlist-playlist').value;

                try {
                    await db.collection('waitlist').add({
                        email: email,
                        playlistUrl: playlist,
                        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                        source: 'napster_theme'
                    });

                    const ticketNum = Math.floor(10000000 + Math.random() * 90000000);
                    runDownloadSimulation(ticketNum);

                } catch (error) {
                    console.error("Firestore Error:", error);
                    alert("Connection failed. Try another peer.");
                } finally {
                    submitBtn.disabled = false;
                }
            });
        }
    }).catch(error => {
        console.warn("Firebase not initialized locally. Ensure this is served via Firebase Hosting or local emulator.", error);
    });
});
