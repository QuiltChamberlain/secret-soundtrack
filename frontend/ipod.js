document.addEventListener('DOMContentLoaded', () => {
    // 1. iPod Clock
    const clockElement = document.getElementById('ipod-clock');
    function updateClock() {
        const now = new Date();
        let hours = now.getHours();
        let minutes = now.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12; // the hour '0' should be '12'
        minutes = minutes < 10 ? '0' + minutes : minutes;
        clockElement.textContent = hours + ':' + minutes + ' ' + ampm;
    }
    updateClock();
    setInterval(updateClock, 60000);

    // 2. iPod UI Navigation
    const menuView = document.getElementById('ipod-menu-view');
    const formView = document.getElementById('ipod-form-view');
    const wheelCenter = document.getElementById('wheel-center');
    const menuBtn = document.querySelector('.wheel-top'); // "MENU"
    
    // Quick mechanical "tick" generator using filtered white noise
    function playClickSound() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                const ctx = new AudioContext();
                
                // 15ms of noise
                const bufferSize = ctx.sampleRate * 0.015; 
                const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) {
                    data[i] = Math.random() * 2 - 1; // White noise
                }
                
                const noise = ctx.createBufferSource();
                noise.buffer = buffer;
                
                // Bandpass filter to make it sound "plastic" and focused
                const filter = ctx.createBiquadFilter();
                filter.type = 'bandpass';
                filter.frequency.value = 4000;
                filter.Q.value = 1.5;
                
                // Very sharp volume envelope (fast decay)
                const gain = ctx.createGain();
                gain.gain.setValueAtTime(0.5, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.015);
                
                noise.connect(filter);
                filter.connect(gain);
                gain.connect(ctx.destination);
                
                noise.start();
            }
        } catch(e) {}
    }

    // Since the wheel is just visual here, we'll map the center button to open the waitlist if active
    wheelCenter.addEventListener('click', () => {
        playClickSound();
        const activeItem = document.querySelector('.ipod-menu-item.active');
        if (activeItem && activeItem.textContent.includes('Join Waitlist')) {
            menuView.classList.add('hidden');
            formView.classList.remove('hidden');
        }
    });

    // Clicking anywhere on the top part of the wheel acts as 'MENU' back button
    document.querySelector('.ipod-click-wheel').addEventListener('click', (e) => {
        // If they click the wheel but NOT the center button, go back to menu
        if (e.target !== wheelCenter) {
            playClickSound();
            formView.classList.add('hidden');
            const successView = document.getElementById('ipod-success-view');
            if (successView) {
                successView.remove();
            }
            menuView.classList.remove('hidden');
        }
    });

    function showSuccessScreen(ticketNum) {
        playClickSound();
        formView.classList.add('hidden');
        
        // Create "Now Playing" Success View
        const successHtml = `
            <div class="ipod-view" id="ipod-success-view" style="flex-direction: column; background: #fff; align-items: center; padding-top: 10px;">
                <div class="ipod-menu-title" style="width: 100%; margin-bottom: 10px;">Now Playing</div>
                <div class="now-playing-art"></div>
                <div class="now-playing-info">
                    <div class="np-title">Waitlist Pass #${ticketNum}</div>
                    <div class="np-artist">Secret Soundtrack</div>
                    <div style="font-size: 10px; margin: 10px 0 5px; color: #666; display: flex; justify-content: space-between; padding: 0 10px;">
                        <span>0:00</span>
                        <span>-4:20</span>
                    </div>
                    <div class="np-progress">
                        <div class="np-progress-fill"></div>
                    </div>
                </div>
            </div>
        `;
        
        const screen = document.querySelector('.ipod-screen');
        screen.insertAdjacentHTML('beforeend', successHtml);
    }

    // Test Animation
    const testBtn = document.getElementById('test-animation-btn');
    if (testBtn) {
        testBtn.addEventListener('click', () => {
            const ticketNum = Math.floor(10000000 + Math.random() * 90000000);
            
            // Hide current views
            menuView.classList.add('hidden');
            formView.classList.add('hidden');
            const oldSuccess = document.getElementById('ipod-success-view');
            if (oldSuccess) oldSuccess.remove();

            showSuccessScreen(ticketNum);
        });
    }

    // 3. Firebase Initialization & Waitlist Submission
    // (You should replace this with your actual config if it differs)
    fetch('/__/firebase/init.json').then(async response => {
        const config = await response.json();
        firebase.initializeApp(config);
        const db = firebase.firestore();

        const waitlistForm = document.getElementById('waitlist-form');
        const submitBtn = document.getElementById('waitlist-submit');

        if (waitlistForm) {
            waitlistForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                submitBtn.innerHTML = 'Saving...';
                submitBtn.disabled = true;

                const email = document.getElementById('waitlist-email').value;
                const playlist = document.getElementById('waitlist-playlist').value;

                try {
                    // Save to Firestore
                    await db.collection('waitlist').add({
                        email: email,
                        playlistUrl: playlist,
                        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                        source: 'ipod_theme'
                    });

                    // Generate Ticket
                    const ticketNum = Math.floor(10000000 + Math.random() * 90000000);
                    showSuccessScreen(ticketNum);

                } catch (error) {
                    console.error("Firestore Error:", error);
                    alert(`Failed to join waitlist. Please try again later.`);
                    submitBtn.innerHTML = 'Sign Up';
                    submitBtn.disabled = false;
                }
            });
        }
    }).catch(error => {
        console.warn("Firebase not initialized locally. Ensure this is served via Firebase Hosting or local emulator.", error);
    });
});
