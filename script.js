document.addEventListener('DOMContentLoaded', () => {
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
    
    // Add simple interactive glow to cards based on mouse position
    const cards = document.querySelectorAll('.glass-card');
    cards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            card.style.background = `
                radial-gradient(
                    circle at ${x}px ${y}px, 
                    rgba(255, 255, 255, 0.08) 0%, 
                    rgba(255, 255, 255, 0.03) 50%
                )
            `;
        });
        
        card.addEventListener('mouseleave', () => {
            card.style.background = 'rgba(255, 255, 255, 0.03)';
        });
    });

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
            const submitBtn = document.getElementById('waitlist-submit');
            
            const email = emailInput.value.trim();
            
            if (!email) return;
            if (!window.db || !window.addDoc) {
                alert("Database not initialized yet. Please try again in a moment.");
                return;
            }
            
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Joining...';
            submitBtn.disabled = true;
            submitBtn.style.opacity = '0.7';
            
            try {
                const waitlistCol = window.collection(window.db, 'waitlist');
                await window.addDoc(waitlistCol, {
                    email: email,
                    timestamp: window.serverTimestamp()
                });
                
                // Show success state
                submitBtn.innerHTML = '&#10003; You\'re on the list!';
                submitBtn.style.backgroundColor = '#10b981'; // Green color for success
                submitBtn.style.opacity = '1';
                
                // Disable input permanently for this session
                emailInput.value = email; // Keep their email visible
                emailInput.disabled = true;
                emailInput.style.opacity = '0.5';
                emailInput.style.cursor = 'not-allowed';
                
            } catch (error) {
                console.error("Firestore Error:", error);
                alert("Failed to join waitlist. Please try again later.");
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
                submitBtn.style.opacity = '1';
            }
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
