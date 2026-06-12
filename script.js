document.addEventListener('DOMContentLoaded', () => {
    let songs = [];
    let currentMenuSongIndex = -1;
    let playingSongIndex = -1;
    let isPlaying = false;

    const audioTracks = {
        vocal: new Audio(),
        drums: new Audio(),
        bass: new Audio(),
        music: new Audio()
    };

    const objectURLs = {
        vocal: null,
        drums: null,
        bass: null,
        music: null
    };

    const grooves = document.querySelectorAll('.groove');
    const modalOverlay = document.getElementById('modal-overlay');
    const btnMenu = document.getElementById('btn-menu');
    const btnCloseModal = document.getElementById('btn-close-modal');
    const btnAddSong = document.getElementById('btn-add-song');
    const songList = document.getElementById('song-list');
    const centerPlayArea = document.getElementById('center-play-area');
    
    const fileInputs = {
        vocal: document.getElementById('file-vocal'),
        drums: document.getElementById('file-drums'),
        bass: document.getElementById('file-bass'),
        music: document.getElementById('file-music')
    };
    const fileLabels = {
        vocal: document.getElementById('label-vocal'),
        drums: document.getElementById('label-drums'),
        bass: document.getElementById('label-bass'),
        music: document.getElementById('label-music')
    };

    const currentSongTitle = document.getElementById('current-song-title');
    const btnPlay = document.getElementById('btn-play');
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');
    const timeCurrent = document.getElementById('time-current');
    const timeTotal = document.getElementById('time-total');
    const progressBarBg = document.getElementById('progress-bar-bg');
    const progressBarFill = document.getElementById('progress-bar-fill');

    const promptOverlay = document.getElementById('prompt-overlay');
    const btnClosePrompt = document.getElementById('btn-close-prompt');
    const promptInput = document.getElementById('prompt-input');

    grooves.forEach(groove => {
        let isPointerDown = false;
        const trackName = groove.getAttribute('data-track');

        const updateVolume = (e) => {
            const dots = Array.from(groove.querySelectorAll('.dot'));
            let minDistance = Infinity;
            let closestIndex = -1;

            dots.forEach((dot) => {
                const rect = dot.getBoundingClientRect();
                const dotCenterX = rect.left + rect.width / 2;
                const dotCenterY = rect.top + rect.height / 2;
                
                const dist = Math.hypot(e.clientX - dotCenterX, e.clientY - dotCenterY);
                if (dist < minDistance) {
                    minDistance = dist;
                    closestIndex = parseInt(dot.getAttribute('data-index'));
                }
            });

            if (closestIndex !== -1) {
                dots.forEach(dot => {
                    const index = parseInt(dot.getAttribute('data-index'));
                    if (index <= closestIndex) {
                        dot.classList.remove('off');
                    } else {
                        dot.classList.add('off');
                    }
                });

                const vol = closestIndex / 3;
                if (audioTracks[trackName]) {
                    audioTracks[trackName].volume = vol;
                }
            }
        };

        groove.addEventListener('pointerdown', (e) => {
            isPointerDown = true;
            groove.setPointerCapture(e.pointerId);
            updateVolume(e);
        });

        groove.addEventListener('pointermove', (e) => {
            if (isPointerDown) updateVolume(e);
        });

        const release = (e) => {
            isPointerDown = false;
            groove.releasePointerCapture(e.pointerId);
        };

        groove.addEventListener('pointerup', release);
        groove.addEventListener('pointercancel', release);
        
        audioTracks[trackName].volume = 1;
    });

    const loadSongToPlayer = (index) => {
        if (index < 0 || index >= songs.length) return;
        
        const song = songs[index];
        playingSongIndex = index;
        currentSongTitle.textContent = song.name;

        pauseAll();

        Object.keys(audioTracks).forEach(track => {
            if (objectURLs[track]) {
                URL.revokeObjectURL(objectURLs[track]);
                objectURLs[track] = null;
            }

            const file = song.files[track];
            if (file) {
                objectURLs[track] = URL.createObjectURL(file);
                audioTracks[track].src = objectURLs[track];
                audioTracks[track].load();
            } else {
                audioTracks[track].src = '';
            }
            audioTracks[track].currentTime = 0;
        });

        if (isPlaying) {
            playAll();
        }
    };

    const playAll = () => {
        if (playingSongIndex === -1) return;
        isPlaying = true;
        btnPlay.textContent = '⏸';
        Object.values(audioTracks).forEach(a => {
            if (a.src) a.play().catch(e => console.log(e));
        });
    };

    const pauseAll = () => {
        isPlaying = false;
        btnPlay.textContent = '▶';
        Object.values(audioTracks).forEach(a => {
            if (a.src) a.pause();
        });
    };

    const togglePlayback = () => {
        if (isPlaying) pauseAll();
        else playAll();
    };

    btnPlay.addEventListener('click', togglePlayback);
    centerPlayArea.addEventListener('click', togglePlayback);

    btnPrev.addEventListener('click', () => {
        if (songs.length === 0) return;
        let newIndex = playingSongIndex - 1;
        if (newIndex < 0) newIndex = songs.length - 1;
        loadSongToPlayer(newIndex);
    });

    btnNext.addEventListener('click', () => {
        if (songs.length === 0) return;
        let newIndex = (playingSongIndex + 1) % songs.length;
        loadSongToPlayer(newIndex);
    });

    const formatTime = (timeInSeconds) => {
        if (isNaN(timeInSeconds)) return "0:00";
        const m = Math.floor(timeInSeconds / 60);
        const s = Math.floor(timeInSeconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const updateProgress = () => {
        let masterTrack = null;
        for (let track of Object.values(audioTracks)) {
            if (track.src && !isNaN(track.duration)) {
                masterTrack = track;
                break;
            }
        }

        if (masterTrack) {
            timeCurrent.textContent = formatTime(masterTrack.currentTime);
            timeTotal.textContent = formatTime(masterTrack.duration);
            const percent = (masterTrack.currentTime / masterTrack.duration) * 100;
            progressBarFill.style.width = `${percent}%`;
        } else {
            timeCurrent.textContent = "0:00";
            timeTotal.textContent = "0:00";
            progressBarFill.style.width = `0%`;
        }

        requestAnimationFrame(updateProgress);
    };
    requestAnimationFrame(updateProgress);

    progressBarBg.addEventListener('click', (e) => {
        let masterTrack = null;
        for (let track of Object.values(audioTracks)) {
            if (track.src && !isNaN(track.duration)) {
                masterTrack = track;
                break;
            }
        }
        
        if (!masterTrack) return;

        const rect = progressBarBg.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const percent = Math.max(0, Math.min(1, clickX / rect.width));
        const newTime = percent * masterTrack.duration;

        Object.values(audioTracks).forEach(a => {
            if (a.src) a.currentTime = newTime;
        });
    });

    btnMenu.addEventListener('click', () => {
        modalOverlay.classList.add('active');
    });

    btnCloseModal.addEventListener('click', () => {
        modalOverlay.classList.remove('active');
    });

    btnAddSong.addEventListener('click', () => {
        promptInput.value = '';
        promptOverlay.classList.add('active');
        promptInput.focus();
    });

    const submitPrompt = () => {
        const name = promptInput.value;
        if (name && name.trim()) {
            songs.push({
                name: name.trim(),
                files: { vocal: null, drums: null, bass: null, music: null }
            });
            renderSongList();
            selectMenuSong(songs.length - 1);
            if (songs.length === 1) {
                loadSongToPlayer(0);
            }
        }
        promptOverlay.classList.remove('active');
    };

    btnClosePrompt.addEventListener('click', () => {
        promptOverlay.classList.remove('active');
    });

    promptInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            submitPrompt();
        }
    });

    promptOverlay.addEventListener('click', (e) => {
        if (e.target === promptOverlay) {
            promptOverlay.classList.remove('active');
        }
    });

    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            modalOverlay.classList.remove('active');
        }
    });

    const renderSongList = () => {
        songList.innerHTML = '';
        songs.forEach((song, index) => {
            const li = document.createElement('li');
            li.textContent = song.name;
            if (index === currentMenuSongIndex) {
                li.classList.add('active');
            }
            li.addEventListener('click', () => selectMenuSong(index));
            songList.appendChild(li);
        });
    };

    const selectMenuSong = (index) => {
        currentMenuSongIndex = index;
        renderSongList();
        
        const song = songs[index];
        Object.keys(fileInputs).forEach(track => {
            fileInputs[track].value = ''; 
            if (song.files[track]) {
                fileLabels[track].textContent = song.files[track].name;
            } else {
                fileLabels[track].textContent = 'Choose file';
            }
        });
    };

    Object.keys(fileInputs).forEach(track => {
        fileInputs[track].addEventListener('change', (e) => {
            if (currentMenuSongIndex === -1) {
                alert('Please select or create a song first!');
                e.target.value = '';
                return;
            }
            const file = e.target.files[0];
            if (file) {
                songs[currentMenuSongIndex].files[track] = file;
                fileLabels[track].textContent = file.name; 
                
                if (currentMenuSongIndex === playingSongIndex) {
                    if (objectURLs[track]) {
                        URL.revokeObjectURL(objectURLs[track]);
                    }
                    objectURLs[track] = URL.createObjectURL(file);
                    
                    const currentTime = audioTracks[track].currentTime || 0;
                    audioTracks[track].src = objectURLs[track];
                    audioTracks[track].currentTime = currentTime; 
                    
                    if (isPlaying) {
                        audioTracks[track].play().catch(err => console.log(err));
                    }
                }
            }
        });
    });
});
