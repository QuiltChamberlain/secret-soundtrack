document.addEventListener('DOMContentLoaded', () => {
    const waitlistForm = document.getElementById('waitlist-form');
    const downloadsTable = document.querySelector('#downloads-table tbody');
    const testAnimBtn = document.getElementById('test-animation-btn');

    function startDownload(ticketNum) {
        // Create a new row for the download
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td>Secret_Soundtrack_Ticket_${ticketNum}.mp3</td>
            <td>4.2 MB</td>
            <td class="status-dl status-cell">Starting...</td>
            <td>
                <div class="prog-bar"><div class="prog-fill" style="width: 0%;"></div></div>
            </td>
            <td class="speed-cell" style="text-align: right;">0.0 KB/s</td>
        `;
        
        // Put it at the top
        downloadsTable.prepend(row);
        
        const statusCell = row.querySelector('.status-cell');
        const fill = row.querySelector('.prog-fill');
        const speedCell = row.querySelector('.speed-cell');
        
        let progress = 0;
        let speed = 0;
        let stuckAt99 = false;
        
        statusCell.textContent = "Downloading...";
        
        const interval = setInterval(() => {
            if (progress < 99) {
                // Normal download
                progress += Math.random() * 5 + 1;
                speed = (Math.random() * 120 + 20).toFixed(1);
            } else if (!stuckAt99) {
                // Anxiety phase: stuck at 99% for a bit
                progress = 99.9;
                speed = 0.0;
                stuckAt99 = true;
                statusCell.textContent = "Waiting for source...";
                
                // Wait 3 seconds at 99% then finish
                setTimeout(() => {
                    clearInterval(interval);
                    fill.style.width = "100%";
                    statusCell.textContent = "Complete";
                    statusCell.className = "status-done status-cell";
                    speedCell.textContent = "";
                    document.getElementById('waitlist-email').value = '';

                    // Trigger BSOD Virus Screen after a brief moment
                    setTimeout(() => {
                        const bsod = document.getElementById('bsod-overlay');
                        const ticketSpan = document.getElementById('bsod-ticket');
                        if(bsod && ticketSpan) {
                            ticketSpan.textContent = ticketNum;
                            bsod.classList.remove('bsod-hidden');
                            
                            // Dismiss BSOD on keypress or click
                            const dismissBsod = () => {
                                bsod.classList.add('bsod-hidden');
                                document.removeEventListener('keydown', dismissBsod);
                                document.removeEventListener('click', dismissBsod);
                            };
                            
                            // Wait 1 second before allowing dismiss so they see it
                            setTimeout(() => {
                                document.addEventListener('keydown', dismissBsod);
                                document.addEventListener('click', dismissBsod);
                            }, 1000);
                        }
                    }, 800);

                }, 3000);
            }
            
            if (!stuckAt99) {
                if (progress > 99) progress = 99;
                fill.style.width = progress + "%";
                speedCell.textContent = speed + " KB/s";
            }
            
        }, 200);
    }

    // Move test button listener outside of Firebase fetch so it always works
    if (testAnimBtn) {
        testAnimBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const ticketNum = Math.floor(10000000 + Math.random() * 90000000);
            startDownload(ticketNum);
        });
    }

    // Splash screen load-in
    setTimeout(() => {
        const splash = document.getElementById('lw-splash');
        if (splash) {
            splash.classList.add('splash-hidden');
        }
    }, 1500);

    // Share button
    const shareBtn = document.getElementById('share-btn');
    if (shareBtn) {
        shareBtn.addEventListener('click', () => {
            if (navigator.share) {
                navigator.share({
                    title: 'Secret Soundtrack',
                    text: 'Join the Secret Soundtrack waitlist! A musical gift swap.',
                    url: window.location.href
                }).catch(console.error);
            } else {
                alert('Copy this link to share: ' + window.location.href);
            }
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

                const email = document.getElementById('waitlist-email').value;
                const playlist = document.getElementById('waitlist-playlist').value;

                try {
                    await db.collection('waitlist').add({
                        email: email,
                        playlistUrl: playlist,
                        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                        source: 'limewire_theme'
                    });

                    const ticketNum = Math.floor(10000000 + Math.random() * 90000000);
                    startDownload(ticketNum);

                } catch (error) {
                    console.error("Firestore Error:", error);
                    alert("Unable to connect to host.");
                } finally {
                    submitBtn.disabled = false;
                }
            });
        }
    }).catch(error => {
        console.warn("Firebase not initialized locally. Ensure this is served via Firebase Hosting or local emulator.", error);
    });
});
