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
    const aboutView = document.getElementById('ipod-about-view');
    const shareView = document.getElementById('ipod-share-view');
    const themesView = document.getElementById('ipod-themes-view');
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

    // 3. Menu Navigation and Actions
    const btnLeft = document.querySelector('.wheel-left');
    const btnRight = document.querySelector('.wheel-right');

    function executeMenuAction(item) {
        if (!item) return;
        playClickSound();

        const link = item.dataset.link;
        if (link) {
            window.location.href = link;
            return;
        }

        const action = item.dataset.action;
        if (!action) return;

        menuView.classList.add('hidden');
        if (action === 'join') {
            formView.classList.remove('hidden');
        } else if (action === 'themes') {
            themesView.classList.remove('hidden');
            // ensure at least one item is active in themes view
            const themesItems = themesView.querySelectorAll('.ipod-menu-item');
            themesItems.forEach(i => i.classList.remove('active'));
            if (themesItems.length > 0) themesItems[0].classList.add('active');
        } else if (action === 'share') {
            if (navigator.share) {
                navigator.share({
                    title: 'Secret Soundtrack',
                    text: 'Give the gift of musical discovery. Join the musical swap group!',
                    url: window.location.href
                }).then(() => {
                    // Go back to menu if share sheet was dismissed successfully
                    menuView.classList.remove('hidden');
                }).catch((e) => {
                    console.error(e);
                    menuView.classList.remove('hidden');
                });
            } else {
                navigator.clipboard.writeText(window.location.href).then(() => {
                    shareView.classList.remove('hidden');
                });
            }
        } else if (action === 'about') {
            aboutView.classList.remove('hidden');
        } else if (action === 'shuffle') {
            // Re-use success screen for shuffle
            showSuccessScreen("SHUFFLE", "Random User Playlist");
        }
    }

    // Allow clicking menu items directly for mouse users
    document.querySelectorAll('.ipod-menu-item').forEach((item) => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            // Find parent view to scope the active class
            const parentView = item.closest('.ipod-view');
            if (parentView) {
                parentView.querySelectorAll('.ipod-menu-item').forEach(i => i.classList.remove('active'));
            }
            item.classList.add('active');
            executeMenuAction(item);
        });
    });

    // Center button executes current active action in the visible view
    wheelCenter.addEventListener('click', (e) => {
        e.stopPropagation();
        playClickSound();
        const visibleView = document.querySelector('.ipod-view:not(.hidden)');
        if (visibleView) {
            const activeItem = visibleView.querySelector('.ipod-menu-item.active');
            if (activeItem) {
                executeMenuAction(activeItem);
            }
        }
    });

    // Scroll wheel simulation (click left/right to move up/down)
    function moveSelection(direction) {
        const visibleView = document.querySelector('.ipod-view:not(.hidden)');
        if (!visibleView) return;
        
        const items = Array.from(visibleView.querySelectorAll('.ipod-menu-item'));
        if (items.length === 0) return; // Not a menu view
        
        playClickSound();
        const activeIndex = items.findIndex(i => i.classList.contains('active'));
        if (activeIndex !== -1) {
            items[activeIndex].classList.remove('active');
        }
        
        let newIndex = activeIndex + direction;
        if (newIndex < 0) newIndex = items.length - 1;
        if (newIndex >= items.length) newIndex = 0;
        
        items[newIndex].classList.add('active');
    }

    btnLeft.addEventListener('click', (e) => {
        e.stopPropagation();
        moveSelection(-1); // Up
    });
    
    btnRight.addEventListener('click', (e) => {
        e.stopPropagation();
        moveSelection(1); // Down
    });

    // Clicking anywhere on the top part of the wheel acts as 'MENU' back button
    const clickWheel = document.querySelector('.ipod-click-wheel');
    clickWheel.addEventListener('click', (e) => {
        // If they click the wheel but NOT the center/left/right buttons, go back to menu
        if (e.target !== wheelCenter && e.target !== btnLeft && e.target !== btnRight) {
            playClickSound();
            formView.classList.add('hidden');
            if (aboutView) aboutView.classList.add('hidden');
            if (shareView) shareView.classList.add('hidden');
            if (themesView) themesView.classList.add('hidden');
            const successView = document.getElementById('ipod-success-view');
            if (successView) {
                successView.remove();
            }
            menuView.classList.remove('hidden');
        }
    });

    // Add actual mouse wheel scrolling over the click wheel
    let scrollAccumulator = 0;
    clickWheel.addEventListener('wheel', (e) => {
        e.preventDefault(); // Prevent page scroll
        scrollAccumulator += e.deltaY;
        
        // Trigger move every 50px of scroll to prevent zooming through menus too fast
        if (scrollAccumulator > 50) {
            moveSelection(1);
            scrollAccumulator = 0;
        } else if (scrollAccumulator < -50) {
            moveSelection(-1);
            scrollAccumulator = 0;
        }
    }, { passive: false });

    // Add touch/pointer support for the click wheel (circular motion)
    let lastAngle = null;
    let touchScrollAccumulator = 0;
    let isDragging = false;

    clickWheel.addEventListener('pointerdown', (e) => {
        if (!e.isPrimary) return;
        isDragging = true;
        clickWheel.setPointerCapture(e.pointerId);
        
        const rect = clickWheel.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        lastAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);
    });

    clickWheel.addEventListener('pointermove', (e) => {
        if (!isDragging || lastAngle === null || !e.isPrimary) return;
        
        const rect = clickWheel.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        let currentAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);
        
        let angleDiff = currentAngle - lastAngle;
        
        // Handle wrapping across 180 / -180 boundary
        if (angleDiff > 180) angleDiff -= 360;
        if (angleDiff < -180) angleDiff += 360;
        
        touchScrollAccumulator += angleDiff;
        lastAngle = currentAngle;

        // Trigger move every 15 degrees of rotation
        if (touchScrollAccumulator > 15) {
            moveSelection(1); // Clockwise -> Down
            touchScrollAccumulator = 0;
        } else if (touchScrollAccumulator < -15) {
            moveSelection(-1); // Counter-Clockwise -> Up
            touchScrollAccumulator = 0;
        }
    });

    const stopDragging = (e) => {
        if (!e.isPrimary) return;
        isDragging = false;
        lastAngle = null;
        touchScrollAccumulator = 0;
        try { clickWheel.releasePointerCapture(e.pointerId); } catch(err) {}
    };

    clickWheel.addEventListener('pointerup', stopDragging);
    clickWheel.addEventListener('pointercancel', stopDragging);

    function showSuccessScreen(ticketNum, customArtist) {
        playClickSound();
        formView.classList.add('hidden');
        
        const titleText = customArtist ? ticketNum : `Waitlist Pass #${ticketNum}`;
        const artistText = customArtist ? customArtist : 'Secret Soundtrack';

        // Create "Now Playing" Success View
        const successHtml = `
            <div class="ipod-view" id="ipod-success-view" style="flex-direction: column; background: #fff; align-items: center; padding-top: 10px;">
                <div class="ipod-menu-title" style="width: 100%; margin-bottom: 10px;">Now Playing</div>
                <div class="now-playing-art"></div>
                <div class="now-playing-info">
                    <div class="np-title">${titleText}</div>
                    <div class="np-artist">${artistText}</div>
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
