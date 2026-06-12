document.addEventListener('DOMContentLoaded', () => {
    
    let songs = [];
    let currentMenuSongIndex = -1;
    let playingSongIndex = -1;
    let isPlaying = false;
    let currentPosition = 0; 
    let playStartTime = 0;
    let playStartOffset = 0;

    
    let scannerPhase = 0;
    let lastProgressTime = 0;

    
    let colorInner = '#a855f7';
    let colorOuter = '#f97316';

    
    let isLoopMode = false;
    let isLoopActive = false;
    let loopStartTime = 0;
    let loopLengthBeats = 8;
    let currentSpeed = 1.0;
    let isReverse = false;
    let savedTrackVolumes = { vocal: 1, drums: 1, bass: 1, music: 1 };
    
    
    let loopModeInitialSpeed = 1.0;
    let loopModeInitialReverse = false;
    let loopModeInitialLoopActive = false;
    
    
    let savedLoopSpeed = 1.0;
    let savedLoopReverse = false;
    let savedLoopActive = false;

    
    let masterVolume = 1.0;
    let volumeTimeout = null;

    
    let soloTrack = null;

    
    let audioCtx = null;
    let masterGainNode = null;

    const tracks = {
        vocal: { source: null, gainNode: null, analyserNode: null, buffer: null, reversedBuffer: null, volume: 1.0 },
        drums: { source: null, gainNode: null, analyserNode: null, buffer: null, reversedBuffer: null, volume: 1.0 },
        bass:  { source: null, gainNode: null, analyserNode: null, buffer: null, reversedBuffer: null, volume: 1.0 },
        music: { source: null, gainNode: null, analyserNode: null, buffer: null, reversedBuffer: null, volume: 1.0 }
    };

    const initAudioContext = () => {
        if (audioCtx) return;
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        masterGainNode = audioCtx.createGain();
        masterGainNode.gain.setValueAtTime(masterVolume, audioCtx.currentTime);
        masterGainNode.connect(audioCtx.destination);

        Object.keys(tracks).forEach(name => {
            const gainNode = audioCtx.createGain();
            const analyserNode = audioCtx.createAnalyser();
            analyserNode.fftSize = 32; 

            gainNode.connect(analyserNode);
            analyserNode.connect(masterGainNode);

            tracks[name].gainNode = gainNode;
            tracks[name].analyserNode = analyserNode;
        });
    };

    const getAudioContext = () => {
        initAudioContext();
        return audioCtx;
    };

    
    const playerContainer = document.querySelector('.player-container');
    const grooves         = document.querySelectorAll('.groove');
    const modalOverlay    = document.getElementById('modal-overlay');
    const btnMenu         = document.getElementById('btn-menu');
    const btnCloseModal   = document.getElementById('btn-close-modal');
    const btnAddSong      = document.getElementById('btn-add-song');
    const songList        = document.getElementById('song-list');
    const centerPlayArea  = document.getElementById('center-play-area');
    const currentSongTitle = document.getElementById('current-song-title');
    const currentSongBpm  = document.getElementById('current-song-bpm');
    const btnPlay         = document.getElementById('btn-play');
    const btnPrev         = document.getElementById('btn-prev');
    const btnNext         = document.getElementById('btn-next');
    const timeCurrent     = document.getElementById('time-current');
    const timeTotal       = document.getElementById('time-total');
    const progressBarBg   = document.getElementById('progress-bar-bg');
    const progressBarFill = document.getElementById('progress-bar-fill');
    const promptOverlay   = document.getElementById('prompt-overlay');
    const btnClosePrompt  = document.getElementById('btn-close-prompt');
    const promptInput     = document.getElementById('prompt-input');
    const bpmValue        = document.getElementById('bpm-value');
    const btnDetectBpm    = document.getElementById('btn-detect-bpm');
    const colorInnerInput = document.getElementById('color-inner');
    const colorOuterInput = document.getElementById('color-outer');
    const swatchInner     = document.getElementById('swatch-inner');
    const swatchOuter     = document.getElementById('swatch-outer');
    const gradientPreview = document.getElementById('color-gradient-preview');

    
    const btnLoopMode     = document.getElementById('btn-loop-mode');
    const btnVolMinus     = document.getElementById('btn-vol-minus');
    const btnVolPlus      = document.getElementById('btn-vol-plus');
    const btnTrackPrev    = document.getElementById('btn-track-prev');
    const btnTrackNext    = document.getElementById('btn-track-next');

    const fileInputs = {
        vocal: document.getElementById('file-vocal'),
        drums: document.getElementById('file-drums'),
        bass:  document.getElementById('file-bass'),
        music: document.getElementById('file-music')
    };
    const fileLabels = {
        vocal: document.getElementById('label-vocal'),
        drums: document.getElementById('label-drums'),
        bass:  document.getElementById('label-bass'),
        music: document.getElementById('label-music')
    };

    
    const hexToRgb = (hex) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return { r, g, b };
    };

    const lerpColor = (hexA, hexB, t) => {
        const a = hexToRgb(hexA);
        const b = hexToRgb(hexB);
        const r = Math.round(a.r + (b.r - a.r) * t);
        const g = Math.round(a.g + (b.g - a.g) * t);
        const bl = Math.round(a.b + (b.b - a.b) * t);
        return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${bl.toString(16).padStart(2,'0')}`;
    };

    const getPalette = () => [
        colorInner,
        lerpColor(colorInner, colorOuter, 1/3),
        lerpColor(colorInner, colorOuter, 2/3),
        colorOuter
    ];

    const applyDotColors = () => {
        const palette = getPalette();

        gradientPreview.innerHTML = '';
        palette.forEach(c => {
            const d = document.createElement('div');
            d.className = 'gradient-dot-preview';
            d.style.backgroundColor = c;
            d.style.boxShadow = `0 0 8px 3px ${c}99`;
            gradientPreview.appendChild(d);
        });

        document.querySelectorAll('.groove').forEach(groove => {
            groove.querySelectorAll('.dot').forEach(dot => {
                const idx = parseInt(dot.getAttribute('data-index'));
                const color = palette[idx];
                const rgb   = hexToRgb(color);
                dot.style.backgroundColor = color;
                dot.style.boxShadow = `0 0 24px 8px rgba(${rgb.r},${rgb.g},${rgb.b},0.8)`;
            });
        });
    };

    applyDotColors();

    colorInnerInput.addEventListener('input', (e) => {
        colorInner = e.target.value;
        swatchInner.style.backgroundColor = colorInner;
        applyDotColors();
        if (currentMenuSongIndex !== -1) {
            songs[currentMenuSongIndex].colorInner = colorInner;
        }
    });
    colorOuterInput.addEventListener('input', (e) => {
        colorOuter = e.target.value;
        swatchOuter.style.backgroundColor = colorOuter;
        applyDotColors();
        if (currentMenuSongIndex !== -1) {
            songs[currentMenuSongIndex].colorOuter = colorOuter;
        }
    });

    
    const getSongDuration = () => {
        let maxDur = 0;
        Object.keys(tracks).forEach(name => {
            if (tracks[name].buffer) {
                maxDur = Math.max(maxDur, tracks[name].buffer.duration);
            }
        });
        return maxDur;
    };

    const getLoopLengthSeconds = (beatsSec) => {
        return loopLengthBeats * beatsSec;
    };

    const getSpeedFromIndex = (index) => {
        switch (index) {
            case 0: return 0.85;
            case 1: return 1.0;
            case 2: return 1.15;
            case 3: return 1.3;
            default: return 1.0;
        }
    };

    const getLoopLengthBeatsFromIndex = (index) => {
        switch (index) {
            case 0: return 1;
            case 1: return 2;
            case 2: return 4;
            case 3: return 8;
            default: return 8;
        }
    };

    const applyGains = () => {
        if (!audioCtx) return;
        Object.keys(tracks).forEach(name => {
            const t = tracks[name];
            let vol = t.volume;

            if (soloTrack !== null) {
                if (name !== soloTrack) {
                    vol = 0;
                }
            }

            if (t.gainNode) {
                t.gainNode.gain.setValueAtTime(vol * masterVolume, audioCtx.currentTime);
            }
        });
    };

    const getTrackAmplitude = (name) => {
        const t = tracks[name];
        if (!t.analyserNode || !isPlaying) return 0;
        
        const bufferLength = t.analyserNode.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        t.analyserNode.getByteTimeDomainData(dataArray);
        
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
            const val = (dataArray[i] - 128) / 128;
            sum += val * val;
        }
        return Math.sqrt(sum / bufferLength);
    };

    const startSources = (offset) => {
        initAudioContext();
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }

        const maxDuration = getSongDuration();
        if (maxDuration === 0) return;

        if (offset < 0) offset = 0;
        if (offset > maxDuration) offset = maxDuration;

        playStartTime = audioCtx.currentTime;
        playStartOffset = offset;

        Object.keys(tracks).forEach(name => {
            const t = tracks[name];
            if (t.source) {
                try { t.source.stop(); } catch(e) {}
                t.source = null;
            }

            const bufferToUse = isReverse ? t.reversedBuffer : t.buffer;
            if (!bufferToUse) return;

            const source = audioCtx.createBufferSource();
            source.buffer = bufferToUse;
            source.connect(t.gainNode);

            const bufferDuration = bufferToUse.duration;
            let startOffset = offset;
            if (isReverse) {
                startOffset = bufferDuration - offset;
            }
            if (startOffset < 0) startOffset = 0;
            if (startOffset > bufferDuration) startOffset = bufferDuration;

            source.playbackRate.value = currentSpeed;

            if (isLoopActive) {
                source.loop = true;
                const song = songs[playingSongIndex];
                const bpm = (song && song.bpm) ? song.bpm : 120;
                const beatsSec = 60 / bpm;
                const loopLen = getLoopLengthSeconds(beatsSec);

                let lStart = loopStartTime;
                let lEnd = loopStartTime + loopLen;
                if (lEnd > maxDuration) {
                    lStart = Math.max(0, maxDuration - loopLen);
                    lEnd = maxDuration;
                }

                if (isReverse) {
                    source.loopStart = Math.max(0, bufferDuration - lEnd);
                    source.loopEnd = Math.min(bufferDuration, bufferDuration - lStart);
                } else {
                    source.loopStart = Math.max(0, lStart);
                    source.loopEnd = Math.min(bufferDuration, lEnd);
                }
            }

            source.start(0, startOffset);
            t.source = source;
        });
    };

    const stopSources = () => {
        updateCurrentPosition();
        Object.keys(tracks).forEach(name => {
            const t = tracks[name];
            if (t.source) {
                try { t.source.stop(); } catch(e) {}
                t.source = null;
            }
        });
    };

    const updateCurrentPosition = () => {
        if (!isPlaying) return;
        const elapsed = (audioCtx.currentTime - playStartTime) * currentSpeed;
        if (isReverse) {
            currentPosition = playStartOffset - elapsed;
        } else {
            currentPosition = playStartOffset + elapsed;
        }

        const duration = getSongDuration();
        if (isLoopActive && duration > 0) {
            const song = songs[playingSongIndex];
            const bpm = (song && song.bpm) ? song.bpm : 120;
            const beatsSec = 60 / bpm;
            const loopLen = getLoopLengthSeconds(beatsSec);
            let lStart = loopStartTime;
            if (lStart + loopLen > duration) {
                lStart = Math.max(0, duration - loopLen);
            }

            if (currentPosition < lStart) {
                currentPosition = lStart + ((currentPosition - lStart) % loopLen + loopLen) % loopLen;
            } else if (currentPosition > lStart + loopLen) {
                currentPosition = lStart + (currentPosition - lStart) % loopLen;
            }
        } else {
            if (currentPosition < 0) currentPosition = 0;
            if (currentPosition > duration) {
                currentPosition = duration;
                pauseAll();
            }
        }
    };

    const getCurrentPlaybackPosition = () => {
        if (!isPlaying) return currentPosition;
        if (!audioCtx) return currentPosition;
        const elapsed = (audioCtx.currentTime - playStartTime) * currentSpeed;
        let pos;
        if (isReverse) {
            pos = playStartOffset - elapsed;
        } else {
            pos = playStartOffset + elapsed;
        }

        const duration = getSongDuration();
        if (isLoopActive && duration > 0) {
            const song = songs[playingSongIndex];
            const bpm = (song && song.bpm) ? song.bpm : 120;
            const beatsSec = 60 / bpm;
            const loopLen = getLoopLengthSeconds(beatsSec);
            let lStart = loopStartTime;
            if (lStart + loopLen > duration) {
                lStart = Math.max(0, duration - loopLen);
            }

            if (pos < lStart) {
                return lStart + ((pos - lStart) % loopLen + loopLen) % loopLen;
            } else {
                return lStart + (pos - lStart) % loopLen;
            }
        } else {
            return Math.max(0, Math.min(duration, pos));
        }
    };

    
    const reverseBuffer = (buffer, audioCtx) => {
        const numChannels = buffer.numberOfChannels;
        const length = buffer.length;
        const sampleRate = buffer.sampleRate;
        const reversed = audioCtx.createBuffer(numChannels, length, sampleRate);
        for (let c = 0; c < numChannels; c++) {
            const chData = buffer.getChannelData(c);
            const revData = reversed.getChannelData(c);
            for (let i = 0; i < length; i++) {
                revData[i] = chData[length - 1 - i];
            }
        }
        return reversed;
    };

    
    const getVerticalDotsBottomToTop = () => {
        const grooveTop = document.querySelector('.groove-vertical.groove-top');
        const grooveBottom = document.querySelector('.groove-vertical.groove-bottom');
        
        const bottomDots = Array.from(grooveBottom.querySelectorAll('.dot'))
            .sort((a, b) => parseInt(b.getAttribute('data-index')) - parseInt(a.getAttribute('data-index')));
            
        const topDots = Array.from(grooveTop.querySelectorAll('.dot'))
            .sort((a, b) => parseInt(a.getAttribute('data-index')) - parseInt(b.getAttribute('data-index')));
            
        return [...bottomDots, ...topDots];
    };

    const getHorizontalDotsLeftToRight = () => {
        const grooveLeft = document.querySelector('.groove-left');
        const grooveRight = document.querySelector('.groove-right');
        
        const leftDots = Array.from(grooveLeft.querySelectorAll('.dot'))
            .sort((a, b) => parseInt(b.getAttribute('data-index')) - parseInt(a.getAttribute('data-index')));
            
        const rightDots = Array.from(grooveRight.querySelectorAll('.dot'))
            .sort((a, b) => parseInt(a.getAttribute('data-index')) - parseInt(b.getAttribute('data-index')));
            
        return [...leftDots, ...rightDots];
    };

    const getClosestVerticalDotIndex = (e) => {
        const verticalDots = getVerticalDotsBottomToTop();
        let minDistance = Infinity;
        let closestIdx = -1;
        
        verticalDots.forEach((dot, idx) => {
            const rect = dot.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            const dist = Math.hypot(e.clientX - cx, e.clientY - cy);
            if (dist < minDistance) {
                minDistance = dist;
                closestIdx = idx;
            }
        });
        return closestIdx;
    };

    
    const renderGroovesInLoopMode = () => {
        let speedIdx = 1;
        if (Math.abs(currentSpeed - 0.85) < 0.01) speedIdx = 0;
        else if (Math.abs(currentSpeed - 1.0) < 0.01) speedIdx = 1;
        else if (Math.abs(currentSpeed - 1.15) < 0.01) speedIdx = 2;
        else if (Math.abs(currentSpeed - 1.3) < 0.01) speedIdx = 3;

        
        let activeVerticalDots = 8;
        if (isLoopActive) {
            if (loopLengthBeats === 0.25) activeVerticalDots = 1;
            else if (loopLengthBeats === 0.5) activeVerticalDots = 2;
            else if (loopLengthBeats === 1) activeVerticalDots = 3;
            else if (loopLengthBeats === 2) activeVerticalDots = 4;
            else if (loopLengthBeats === 4) activeVerticalDots = 5;
            else if (loopLengthBeats === 8) activeVerticalDots = 6;
            else if (loopLengthBeats === 16) activeVerticalDots = 7;
        } else {
            activeVerticalDots = 8;
        }

        const verticalDots = getVerticalDotsBottomToTop();
        verticalDots.forEach((dot, idx) => {
            dot.style.filter = ''; 
            if (idx < activeVerticalDots) {
                dot.classList.remove('off');
            } else {
                dot.classList.add('off');
            }
        });

        
        const rightGroove = document.querySelector('.groove-right');
        const rightDots = rightGroove.querySelectorAll('.dot');
        rightDots.forEach(dot => {
            dot.style.filter = ''; 
            const idx = parseInt(dot.getAttribute('data-index'));
            if (!isReverse && idx === speedIdx) {
                dot.classList.remove('off');
            } else {
                dot.classList.add('off');
            }
        });

        
        const leftGroove = document.querySelector('.groove-left');
        const leftDots = leftGroove.querySelectorAll('.dot');
        leftDots.forEach(dot => {
            dot.style.filter = ''; 
            const idx = parseInt(dot.getAttribute('data-index'));
            if (isReverse && idx === speedIdx) {
                dot.classList.remove('off');
            } else {
                dot.classList.add('off');
            }
        });
    };

    
    const showVolumeIndicator = () => {
        if (volumeTimeout) {
            clearTimeout(volumeTimeout);
        }

        
        document.querySelectorAll('.dot').forEach(dot => {
            dot.style.filter = '';
            dot.classList.remove('volume-active');
        });

        playerContainer.classList.add('volume-indicator-active');

        const activeDotCount = Math.round(masterVolume * 8);
        const verticalDots = getVerticalDotsBottomToTop();
        for (let i = 0; i < activeDotCount; i++) {
            if (verticalDots[i]) {
                verticalDots[i].classList.add('volume-active');
            }
        }

        volumeTimeout = setTimeout(() => {
            playerContainer.classList.remove('volume-indicator-active');
            document.querySelectorAll('.dot.volume-active').forEach(dot => {
                dot.classList.remove('volume-active');
            });
        }, 1500);
    };

    const updateBpmDisplay = () => {
        const song = songs[playingSongIndex];
        if (song && song.bpm) {
            const adjustedBpm = Math.round(song.bpm * currentSpeed);
            currentSongBpm.textContent = `${adjustedBpm} BPM` + (isReverse ? ' (REV)' : '');
        } else {
            currentSongBpm.textContent = '';
        }
    };

    
    grooves.forEach(groove => {
        let isPointerDown = false;
        const trackName = groove.getAttribute('data-track');
        let soloTimeout = null;

        const updateVolume = (e) => {
            if (!isLoopMode) {
                const dots = Array.from(groove.querySelectorAll('.dot'));
                let minDistance = Infinity;
                let closestIndex = -1;

                dots.forEach(dot => {
                    const rect = dot.getBoundingClientRect();
                    const cx = rect.left + rect.width  / 2;
                    const cy = rect.top  + rect.height / 2;
                    const dist = Math.hypot(e.clientX - cx, e.clientY - cy);
                    if (dist < minDistance) {
                        minDistance = dist;
                        closestIndex = parseInt(dot.getAttribute('data-index'));
                    }
                });

                if (closestIndex !== -1) {
                    dots.forEach(dot => {
                        const idx = parseInt(dot.getAttribute('data-index'));
                        if (idx <= closestIndex) dot.classList.remove('off');
                        else                     dot.classList.add('off');
                    });
                    tracks[trackName].volume = closestIndex / 3;
                    applyGains();
                }
            } else {
                
                if (trackName === 'drums' || trackName === 'music') {
                    const dots = Array.from(groove.querySelectorAll('.dot'));
                    let minDistance = Infinity;
                    let closestIndex = -1;
                    dots.forEach(dot => {
                        const rect = dot.getBoundingClientRect();
                        const cx = rect.left + rect.width  / 2;
                        const cy = rect.top  + rect.height / 2;
                        const dist = Math.hypot(e.clientX - cx, e.clientY - cy);
                        if (dist < minDistance) {
                            minDistance = dist;
                            closestIndex = parseInt(dot.getAttribute('data-index'));
                        }
                    });

                    if (closestIndex !== -1) {
                        if (trackName === 'drums') {
                            currentSpeed = getSpeedFromIndex(closestIndex);
                            isReverse = false;
                            
                            const curPos = getCurrentPlaybackPosition();
                            if (isPlaying) {
                                stopSources();
                                currentPosition = curPos;
                                startSources(currentPosition);
                            } else {
                                currentPosition = curPos;
                            }
                            renderGroovesInLoopMode();
                            updateBpmDisplay();
                        } else {
                            currentSpeed = getSpeedFromIndex(closestIndex);
                            isReverse = true;
                            
                            const curPos = getCurrentPlaybackPosition();
                            if (isPlaying) {
                                stopSources();
                                currentPosition = curPos;
                                startSources(currentPosition);
                            } else {
                                currentPosition = curPos;
                            }
                            renderGroovesInLoopMode();
                            updateBpmDisplay();
                        }
                    }
                } else if (trackName === 'vocal' || trackName === 'bass') {
                    const closestVerticalIdx = getClosestVerticalDotIndex(e);
                    if (closestVerticalIdx !== -1) {
                        if (closestVerticalIdx === 0) {
                            loopLengthBeats = 0.25;
                            isLoopActive = true;
                        } else if (closestVerticalIdx === 1) {
                            loopLengthBeats = 0.5;
                            isLoopActive = true;
                        } else if (closestVerticalIdx === 2) {
                            loopLengthBeats = 1;
                            isLoopActive = true;
                        } else if (closestVerticalIdx === 3) {
                            loopLengthBeats = 2;
                            isLoopActive = true;
                        } else if (closestVerticalIdx === 4) {
                            loopLengthBeats = 4;
                            isLoopActive = true;
                        } else if (closestVerticalIdx === 5) {
                            loopLengthBeats = 8;
                            isLoopActive = true;
                        } else if (closestVerticalIdx === 6) {
                            loopLengthBeats = 16;
                            isLoopActive = true;
                        } else {
                            loopLengthBeats = 8;
                            isLoopActive = false; 
                        }
                        
                        const curPos = getCurrentPlaybackPosition();
                        loopStartTime = curPos;

                        if (isPlaying) {
                            stopSources();
                            currentPosition = curPos;
                            startSources(currentPosition);
                        } else {
                            currentPosition = curPos;
                        }
                        renderGroovesInLoopMode();
                    }
                }
            }
        };

        groove.addEventListener('pointerdown', (e) => {
            isPointerDown = true;
            groove.setPointerCapture(e.pointerId);

            if (!isLoopMode) {
                soloTimeout = setTimeout(() => {
                    soloTrack = trackName;
                    playerContainer.classList.add('solo-active');
                    groove.classList.add('solo-target');
                    applyGains();
                }, 1000);
            }

            updateVolume(e);
        });

        groove.addEventListener('pointermove', (e) => { if (isPointerDown) updateVolume(e); });
        
        const release = (e) => {
            if (soloTimeout) {
                clearTimeout(soloTimeout);
                soloTimeout = null;
            }
            if (isPointerDown) {
                isPointerDown = false;
                try { groove.releasePointerCapture(e.pointerId); } catch(err) {}
                if (soloTrack === trackName) {
                    soloTrack = null;
                    playerContainer.classList.remove('solo-active');
                    groove.classList.remove('solo-target');
                    applyGains();
                }
            }
        };
        groove.addEventListener('pointerup',     release);
        groove.addEventListener('pointercancel', release);
        groove.addEventListener('pointerleave',  release);
    });

    
    const loadSongToPlayer = (index) => {
        if (index < 0 || index >= songs.length) return;
        const song = songs[index];
        playingSongIndex = index;
        currentSongTitle.textContent = song.name;

        
        if (song.colorInner) { colorInner = song.colorInner; colorInnerInput.value = colorInner; swatchInner.style.backgroundColor = colorInner; }
        if (song.colorOuter) { colorOuter = song.colorOuter; colorOuterInput.value = colorOuter; swatchOuter.style.backgroundColor = colorOuter; }
        applyDotColors();

        if (isPlaying) stopSources();
        currentPosition = 0;
        isLoopActive = false;

        
        Object.keys(tracks).forEach(name => {
            tracks[name].buffer = song.buffers[name] || null;
            tracks[name].reversedBuffer = song.reversedBuffers[name] || null;
            
            
            const groove = document.querySelector(`.groove[data-track="${name}"]`);
            const dots = groove.querySelectorAll('.dot');
            const volVal = tracks[name].volume;
            const activeIdx = Math.round(volVal * 3);
            dots.forEach(dot => {
                dot.style.filter = ''; 
                const idx = parseInt(dot.getAttribute('data-index'));
                if (idx <= activeIdx) dot.classList.remove('off');
                else dot.classList.add('off');
            });
        });

        updateBpmDisplay();
        applyGains();

        if (isPlaying) {
            startSources(0);
        }
    };

    const playAll = () => {
        if (playingSongIndex === -1) return;
        isPlaying = true;
        btnPlay.textContent = '⏸';
        startSources(currentPosition);
    };

    const pauseAll = () => {
        if (!isPlaying) return;
        btnPlay.textContent = '▶';
        stopSources();
        isPlaying = false;
    };

    const togglePlayback = (fromCenterPlay = false) => {
        if (playingSongIndex === -1) return;
        
        
        if (isLoopMode && fromCenterPlay) {
            
            const hasChanges = (currentSpeed !== loopModeInitialSpeed) || 
                             (isReverse !== loopModeInitialReverse) || 
                             (isLoopActive !== loopModeInitialLoopActive);
            
            if (!hasChanges) {
                
                isLoopMode = false;
                btnLoopMode.classList.remove('active');

                
                document.querySelectorAll('.dot.playback-pointer').forEach(dot => {
                    dot.classList.remove('playback-pointer');
                    dot.style.filter = '';
                });

                
                document.querySelectorAll('.dot').forEach(dot => {
                    dot.classList.remove('loop-active');
                    dot.style.filter = '';
                });

                
                Object.keys(tracks).forEach(name => {
                    tracks[name].volume = savedTrackVolumes[name];
                    
                    const groove = document.querySelector(`.groove[data-track="${name}"]`);
                    const dots = groove.querySelectorAll('.dot');
                    const activeIdx = Math.round(tracks[name].volume * 3);
                    dots.forEach(dot => {
                        const idx = parseInt(dot.getAttribute('data-index'));
                        if (idx <= activeIdx) dot.classList.remove('off');
                        else dot.classList.add('off');
                    });
                });

                applyGains();
                return;
            } else {
                
                currentSpeed = 1.0;
                isReverse = false;
                isLoopActive = false; 
                loopLengthBeats = 8;
                loopModeInitialSpeed = 1.0;
                loopModeInitialReverse = false;
                loopModeInitialLoopActive = false;
                
                const curPos = getCurrentPlaybackPosition();
                if (isPlaying) {
                    stopSources();
                    currentPosition = curPos;
                    startSources(currentPosition);
                } else {
                    currentPosition = curPos;
                }
                renderGroovesInLoopMode();
                updateBpmDisplay();
                return;
            }
        }

        
        if (isPlaying) pauseAll();
        else playAll();
    };

    
    btnPlay.addEventListener('click', () => togglePlayback(false));
    
    
    centerPlayArea.addEventListener('click', () => togglePlayback(true));

    const prevSong = () => {
        if (!songs.length) return;
        let i = playingSongIndex - 1;
        if (i < 0) i = songs.length - 1;
        loadSongToPlayer(i);
    };

    const nextSong = () => {
        if (!songs.length) return;
        loadSongToPlayer((playingSongIndex + 1) % songs.length);
    };

    btnPrev.addEventListener('click', prevSong);
    btnNext.addEventListener('click', nextSong);

    
    btnTrackPrev.addEventListener('click', prevSong);
    btnTrackNext.addEventListener('click', nextSong);

    
    btnLoopMode.addEventListener('click', () => {
        initAudioContext();
        isLoopMode = !isLoopMode;

        if (isLoopMode) {
            
            if (volumeTimeout) {
                clearTimeout(volumeTimeout);
                volumeTimeout = null;
            }
            playerContainer.classList.remove('volume-indicator-active');
            document.querySelectorAll('.dot.volume-active').forEach(dot => {
                dot.classList.remove('volume-active');
                dot.style.filter = '';
            });

            btnLoopMode.classList.add('active');
            
            
            
            savedTrackVolumes = {
                vocal: tracks.vocal.volume,
                drums: tracks.drums.volume,
                bass:  tracks.bass.volume,
                music: tracks.music.volume
            };

            
            document.querySelectorAll('.dot').forEach(dot => {
                dot.style.filter = ''; 
                dot.classList.add('loop-active');
            });

            isLoopActive = false; 
            loopLengthBeats = 8;
            currentSpeed = savedLoopSpeed; 
            isReverse = savedLoopReverse;
            isLoopActive = savedLoopActive;
            
            
            loopModeInitialSpeed = savedLoopSpeed;
            loopModeInitialReverse = savedLoopReverse;
            loopModeInitialLoopActive = savedLoopActive;
            
            scannerPhase = 0;
            loopStartTime = getCurrentPlaybackPosition();

            
            renderGroovesInLoopMode();

            
            const curPos = getCurrentPlaybackPosition();
            if (isPlaying) {
                stopSources();
                currentPosition = curPos;
                startSources(currentPosition);
            } else {
                currentPosition = curPos;
            }
        } else {
            
            savedLoopSpeed = currentSpeed;
            savedLoopReverse = isReverse;
            savedLoopActive = isLoopActive;
            
            btnLoopMode.classList.remove('active');

            
            document.querySelectorAll('.dot.playback-pointer').forEach(dot => {
                dot.classList.remove('playback-pointer');
                dot.style.filter = '';
            });

            
            document.querySelectorAll('.dot').forEach(dot => {
                dot.classList.remove('loop-active');
                dot.style.filter = '';
            });

            
            Object.keys(tracks).forEach(name => {
                tracks[name].volume = savedTrackVolumes[name];
                
                const groove = document.querySelector(`.groove[data-track="${name}"]`);
                const dots = groove.querySelectorAll('.dot');
                const activeIdx = Math.round(tracks[name].volume * 3);
                dots.forEach(dot => {
                    const idx = parseInt(dot.getAttribute('data-index'));
                    if (idx <= activeIdx) dot.classList.remove('off');
                    else dot.classList.add('off');
                });
            });

            applyGains();
        }
    });

    
    const adjustVolume = (delta) => {
        if (isLoopMode) return; 
        initAudioContext();

        masterVolume = Math.max(0.0, Math.min(1.0, masterVolume + delta));
        if (masterGainNode) {
            masterGainNode.gain.setValueAtTime(masterVolume, audioCtx.currentTime);
        }
        applyGains();
        showVolumeIndicator();
    };

    btnVolMinus.addEventListener('click', () => adjustVolume(-0.125));
    btnVolPlus.addEventListener('click', () => adjustVolume(0.125));

    
    const fmt = (s) => {
        if (isNaN(s)) return '0:00';
        return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
    };

    const updateProgress = () => {
        const nowCtx = audioCtx ? audioCtx.currentTime : 0;
        if (lastProgressTime === 0) lastProgressTime = nowCtx;
        const deltaSec = isPlaying ? (nowCtx - lastProgressTime) * currentSpeed : 0;
        lastProgressTime = nowCtx;

        const pos = getCurrentPlaybackPosition();
        const duration = getSongDuration();
        
        if (duration > 0) {
            timeCurrent.textContent = fmt(pos);
            timeTotal.textContent   = fmt(duration);
            progressBarFill.style.width = `${(pos / duration) * 100}%`;
            
            
            if (isLoopMode && isPlaying) {
                if (isReverse) {
                    scannerPhase -= deltaSec;
                    if (scannerPhase < 0) {
                        scannerPhase = 1 + (scannerPhase % 1);
                    }
                } else {
                    scannerPhase += deltaSec;
                    if (scannerPhase > 1) {
                        scannerPhase = scannerPhase % 1;
                    }
                }
            }

            
            if (!isLoopMode && !playerContainer.classList.contains('volume-indicator-active')) {
                Object.keys(tracks).forEach(name => {
                    const groove = document.querySelector(`.groove[data-track="${name}"]`);
                    if (!groove) return;
                    const dots = groove.querySelectorAll('.dot');
                    
                    const activeIdx = Math.round(tracks[name].volume * 3);
                    const rms = getTrackAmplitude(name);
                    
                    
                    
                    let litDotsCount = 1;
                    if (isPlaying) {
                        litDotsCount = 1 + Math.floor(rms * 10); 
                        litDotsCount = Math.min(4, Math.max(1, litDotsCount));
                    }

                    dots.forEach(dot => {
                        const idx = parseInt(dot.getAttribute('data-index'));
                        if (idx < litDotsCount) {
                            
                            dot.classList.remove('off');
                            dot.style.filter = `blur(2px) brightness(1.5)`;
                        } else if (idx <= activeIdx) {
                            
                            dot.classList.remove('off');
                            dot.style.filter = `blur(2px) brightness(1.0)`;
                        } else {
                            
                            dot.classList.add('off');
                            dot.style.filter = '';
                        }
                    });
                });
            }

            
            if (isLoopMode) {
                document.querySelectorAll('.dot.playback-pointer').forEach(dot => {
                    dot.classList.remove('playback-pointer');
                    dot.style.filter = '';
                });

                const pointerIndex = Math.min(7, Math.floor(scannerPhase * 8));
                const horizontalDots = getHorizontalDotsLeftToRight();
                if (horizontalDots[pointerIndex]) {
                    horizontalDots[pointerIndex].classList.add('playback-pointer');
                }
            }

            if (!isLoopActive && pos >= duration && isPlaying) {
                pauseAll();
                currentPosition = duration;
            }
        } else {
            timeCurrent.textContent = '0:00';
            timeTotal.textContent   = '0:00';
            progressBarFill.style.width = '0%';
        }
        requestAnimationFrame(updateProgress);
    };
    requestAnimationFrame(updateProgress);

    progressBarBg.addEventListener('click', (e) => {
        const duration = getSongDuration();
        if (duration === 0) return;
        const rect = progressBarBg.getBoundingClientRect();
        const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const targetPos = pct * duration;

        if (isPlaying) {
            stopSources();
            currentPosition = targetPos;
            if (isLoopActive) {
                loopStartTime = targetPos;
            }
            startSources(currentPosition);
        } else {
            currentPosition = targetPos;
            if (isLoopActive) {
                loopStartTime = targetPos;
            }
        }
    });

    
    const estimateBpm = async (audioBuffer) => {
        const sampleRate = audioBuffer.sampleRate;
        const numChannels = audioBuffer.numberOfChannels;

        const length = audioBuffer.length;
        const mono = new Float32Array(length);
        for (let c = 0; c < numChannels; c++) {
            const ch = audioBuffer.getChannelData(c);
            for (let i = 0; i < length; i++) mono[i] += ch[i] / numChannels;
        }

        const windowSize = Math.floor(sampleRate * 0.01); 
        const hopSize    = windowSize;
        const frames     = Math.floor(length / hopSize);
        const envelope   = new Float32Array(frames);
        for (let f = 0; f < frames; f++) {
            let sum = 0;
            const start = f * hopSize;
            for (let i = start; i < start + windowSize && i < length; i++) {
                sum += mono[i] * mono[i];
            }
            envelope[f] = Math.sqrt(sum / windowSize);
        }

        const frameRate = sampleRate / hopSize; 
        const minBPM = 60, maxBPM = 200;
        const minLag  = Math.floor(frameRate * 60 / maxBPM);
        const maxLag  = Math.floor(frameRate * 60 / minBPM);

        let bestLag = minLag;
        let bestCorr = -Infinity;
        const n = Math.min(envelope.length, maxLag * 4); 

        for (let lag = minLag; lag <= maxLag; lag++) {
            let corr = 0;
            for (let i = 0; i < n - lag; i++) {
                corr += envelope[i] * envelope[i + lag];
            }
            if (corr > bestCorr) { bestCorr = corr; bestLag = lag; }
        }

        const bpm = Math.round(frameRate * 60 / bestLag);
        return bpm;
    };

    btnDetectBpm.addEventListener('click', async () => {
        if (currentMenuSongIndex === -1) return;
        const song = songs[currentMenuSongIndex];

        const trackOrder = ['drums', 'music', 'bass', 'vocal'];
        let buffer = null;
        for (const t of trackOrder) {
            if (song.buffers[t]) { buffer = song.buffers[t]; break; }
        }
        if (!buffer) { bpmValue.textContent = '—'; return; }

        btnDetectBpm.classList.add('spinning');
        bpmValue.textContent = '…';

        try {
            const bpm = await estimateBpm(buffer);
            song.bpm = bpm;
            bpmValue.textContent = bpm;

            if (currentMenuSongIndex === playingSongIndex) {
                updateBpmDisplay();
            }
        } catch (err) {
            console.error('BPM detection failed:', err);
            bpmValue.textContent = 'err';
        } finally {
            btnDetectBpm.classList.remove('spinning');
        }
    });

    
    btnMenu.addEventListener('click', () => modalOverlay.classList.add('active'));
    btnCloseModal.addEventListener('click', () => modalOverlay.classList.remove('active'));
    modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) modalOverlay.classList.remove('active'); });

    
    btnAddSong.addEventListener('click', () => {
        promptInput.value = '';
        promptOverlay.classList.add('active');
        promptInput.focus();
    });

    const submitPrompt = () => {
        const name = promptInput.value.trim();
        if (name) {
            const randomHex = () => '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
            songs.push({
                name,
                files: { vocal: null, drums: null, bass: null, music: null },
                buffers: { vocal: null, drums: null, bass: null, music: null },
                reversedBuffers: { vocal: null, drums: null, bass: null, music: null },
                bpm: null,
                colorInner: randomHex(),
                colorOuter: randomHex()
            });
            renderSongList();
            selectMenuSong(songs.length - 1);
            if (songs.length === 1) loadSongToPlayer(0);
        }
        promptOverlay.classList.remove('active');
    };

    btnClosePrompt.addEventListener('click', () => promptOverlay.classList.remove('active'));
    promptInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitPrompt(); });
    promptOverlay.addEventListener('click', (e) => { if (e.target === promptOverlay) promptOverlay.classList.remove('active'); });

    
    const renderSongList = () => {
        songList.innerHTML = '';
        songs.forEach((song, i) => {
            const li = document.createElement('li');
            li.textContent = song.name;
            if (i === currentMenuSongIndex) li.classList.add('active');
            li.addEventListener('click', () => selectMenuSong(i));
            songList.appendChild(li);
        });
    };

    const selectMenuSong = (index) => {
        currentMenuSongIndex = index;
        renderSongList();

        const song = songs[index];

        Object.keys(fileInputs).forEach(track => {
            fileInputs[track].value = '';
            fileLabels[track].textContent = song.files[track] ? song.files[track].name : 'Choose file';
        });

        bpmValue.textContent = song.bpm != null ? song.bpm : '—';

        colorInner = song.colorInner || '#a855f7';
        colorOuter = song.colorOuter || '#f97316';
        colorInnerInput.value = colorInner;
        colorOuterInput.value = colorOuter;
        swatchInner.style.backgroundColor = colorInner;
        swatchOuter.style.backgroundColor = colorOuter;
        applyDotColors();
    };

    
    Object.keys(fileInputs).forEach(track => {
        fileInputs[track].addEventListener('change', async (e) => {
            if (currentMenuSongIndex === -1) { e.target.value = ''; return; }
            const file = e.target.files[0];
            if (!file) return;

            const targetSongIdx = currentMenuSongIndex;
            songs[targetSongIdx].files[track] = file;
            fileLabels[track].textContent = 'Decoding...';

            try {
                const arrayBuffer = await file.arrayBuffer();
                const tempCtx = getAudioContext() || new (window.AudioContext || window.webkitAudioContext)();
                const decoded = await tempCtx.decodeAudioData(arrayBuffer);
                
                songs[targetSongIdx].buffers[track] = decoded;
                songs[targetSongIdx].reversedBuffers[track] = reverseBuffer(decoded, tempCtx);
                
                fileLabels[track].textContent = file.name;

                
                if (targetSongIdx === playingSongIndex) {
                    loadSongToPlayer(playingSongIndex);
                }
            } catch (err) {
                console.error('Decoding failed:', err);
                fileLabels[track].textContent = 'Decoding error';
            }
        });
    });
});
