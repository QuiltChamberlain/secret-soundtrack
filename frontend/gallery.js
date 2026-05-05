document.addEventListener('DOMContentLoaded', () => {
    // Cassette Tape Loader
    const loader = document.getElementById('loader');
    if (loader) {
        setTimeout(() => {
            loader.classList.add('hidden');
            setTimeout(() => {
                loader.style.display = 'none';
            }, 600);
        }, 1500);
    }

    // Intersection Observer for fade-in animations on scroll
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.15
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Add visible class
                entry.target.classList.add('visible');
                
                // Optional: add slight delay based on custom property for staggered grids
                const delay = entry.target.style.getPropertyValue('--delay');
                if (delay) {
                    entry.target.style.transitionDelay = delay;
                }
                
                // Stop observing once animated
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Observe all elements with .fade-in-up class
    const animatedElements = document.querySelectorAll('.fade-in-up');
    animatedElements.forEach(el => observer.observe(el));
    
    // Removed Particles and Glass Glow for Gallery Theme

    // 1. Smooth Scrolling for CTAs
    const navCta = document.getElementById('nav-cta');
    const bottomCta = document.getElementById('bottom-cta');
    const waitlistForm = document.getElementById('waitlist-form');
    
    const scrollToForm = (e) => {
        e.preventDefault();
        const formRect = waitlistForm.getBoundingClientRect();
        const absoluteY = formRect.top + window.scrollY;
        // Scroll slightly above the form
        window.scrollTo({
            top: absoluteY - 150,
            behavior: 'smooth'
        });
        
        // Give focus to the email input after scrolling
        setTimeout(() => {
            document.getElementById('waitlist-email').focus();
        }, 800);
    };

    if (navCta) navCta.addEventListener('click', scrollToForm);
    if (bottomCta) bottomCta.addEventListener('click', scrollToForm);

    // Share Feature
    const shareBtn = document.getElementById('share-btn');
    if (shareBtn) {
        shareBtn.addEventListener('click', async () => {
            if (navigator.share) {
                try {
                    await navigator.share({
                        title: 'Secret Soundtrack',
                        text: 'Give the gift of musical discovery. Join the Secret Santa inspired musical swap group.',
                        url: window.location.href,
                    });
                } catch (err) {
                    console.log('Error sharing:', err);
                }
            } else {
                alert('Sharing is not supported on this browser. Copy the URL to share!');
            }
        });
    }

    // 2. Waitlist Form Submission (Firebase Firestore)
    if (waitlistForm) {
        waitlistForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const emailInput = document.getElementById('waitlist-email');
            const playlistInput = document.getElementById('waitlist-playlist');
            const submitBtn = document.getElementById('waitlist-submit');
            
            const email = emailInput.value.trim();
            const playlist = playlistInput ? playlistInput.value.trim() : '';
            
            if (!email) return;
            if (!window.db || !window.setDoc || !window.doc) {
                alert("Database not initialized yet. Please try again in a moment.");
                return;
            }
            
            const originalHTML = submitBtn.innerHTML;
            submitBtn.innerHTML = 'Sending...';
            submitBtn.disabled = true;
            try {
                const docRef = window.doc(window.db, 'campaigns', 'waitlist', 'submissions', email.toLowerCase());
                await window.setDoc(docRef, {
                    email: email,
                    playlistUrl: playlist,
                    lastUpdatedAt: window.serverTimestamp()
                }, { merge: true });
                
                // Generate a random ticket barcode number
                const ticketNum = Math.floor(10000000 + Math.random() * 90000000);

                // Show success state with Concert Pass Animation
                waitlistForm.innerHTML = `
                    <div class="envelope-container">
                        <div class="envelope-wrapper">
                            <div class="envelope-back"></div>
                            <div class="envelope-pocket">
                                <div class="envelope-paper ticket-paper">
                                    <div class="ticket-header">SECRET SOUNDTRACK</div>
                                    <div class="ticket-campaign">WAITLIST PASS</div>
                                    <div class="ticket-barcode-container">
                                        <div class="barcode-lines"></div>
                                        <span class="ticket-barcode">#${ticketNum}</span>
                                    </div>
                                </div>
                            </div>
                            <div class="envelope-front"></div>
                            <div class="envelope-flap"></div>
                        </div>
                        <div class="envelope-success-text">You're on the list!</div>
                    </div>
                `;
                waitlistForm.style.display = 'block'; // Ensure form structure holds the envelope properly
                
            } catch (error) {
                console.error("Firestore Error:", error.code, error.message, error);
                alert(`Failed to join waitlist. Please try again later. (Error: ${error.message || 'Unknown'})`);
                submitBtn.innerHTML = originalHTML;
                submitBtn.disabled = false;
            }
        });
    }

    // Test Animation logic (No DB Write)
    const testAnimBtn = document.getElementById('test-animation-btn');
    if (testAnimBtn && waitlistForm) {
        testAnimBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const ticketNum = Math.floor(10000000 + Math.random() * 90000000);
            waitlistForm.innerHTML = `
                <div class="envelope-container">
                    <div class="envelope-wrapper">
                        <div class="envelope-back"></div>
                        <div class="envelope-pocket">
                            <div class="envelope-paper ticket-paper">
                                <div class="ticket-header">SECRET SOUNDTRACK</div>
                                <div class="ticket-campaign">WAITLIST PASS</div>
                                <div class="ticket-barcode-container">
                                    <div class="barcode-lines"></div>
                                    <span class="ticket-barcode">#${ticketNum}</span>
                                </div>
                            </div>
                        </div>
                        <div class="envelope-front"></div>
                        <div class="envelope-flap"></div>
                    </div>
                    <div class="envelope-success-text">Test Mode: You're on the list!</div>
                </div>
            `;
            waitlistForm.style.display = 'block';
        });
    }

    // 3. Interactive Mockup Playlist
    const tracks = document.querySelectorAll('.track');
    tracks.forEach(track => {
        track.addEventListener('mouseenter', () => {
            const icon = track.querySelector('.track-icon');
            if (icon) {
                // Change music note to play button on hover
                icon.dataset.original = icon.textContent;
                icon.textContent = '▶️';
            }
        });
        
        track.addEventListener('mouseleave', () => {
            const icon = track.querySelector('.track-icon');
            if (icon && icon.dataset.original) {
                icon.textContent = icon.dataset.original;
            }
        });
        
        track.addEventListener('click', () => {
            // Simulate track selection
            tracks.forEach(t => t.style.backgroundColor = 'transparent');
            track.style.backgroundColor = 'rgba(255,255,255,0.05)';
            track.style.borderRadius = '8px';
            
            const icon = track.querySelector('.track-icon');
            if (icon) {
                // Reset other icons
                tracks.forEach(t => {
                    const i = t.querySelector('.track-icon');
                    if (i && i !== icon && i.textContent === '⏸️') i.textContent = '🎶';
                });
                icon.textContent = icon.textContent === '⏸️' ? '▶️' : '⏸️';
                icon.dataset.original = icon.textContent;
            }
        });
    });
});
