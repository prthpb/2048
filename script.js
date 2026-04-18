const gridBackground = document.getElementById('grid-background');
const tileContainer = document.getElementById('tile-container');
const scoreEl = document.getElementById('score');
const bestScoreEl = document.getElementById('best-score');
const undoBtn = document.getElementById('undo-btn');
const restartBtn = document.getElementById('restart-btn');
const gameOverScreen = document.getElementById('game-over');
const gameWonScreen = document.getElementById('game-won');
const tryAgainBtn = document.getElementById('try-again-btn');
const playAgainBtn = document.getElementById('play-again-btn');
const keepGoingBtn = document.getElementById('keep-going-btn');
const canvas = document.getElementById('particle-canvas');
const ctx = canvas.getContext('2d');

let board = [];
let score = 0;
let bestScore = localStorage.getItem('2048-best') || 0;
let undoStack = [];
let won = false;
let keepPlaying = false;
let isAnimating = false;

// Particle System
let particles = [];
canvas.width = 475;
canvas.height = 475;

// Initialize Grid Background
for (let i = 0; i < 16; i++) {
    const cell = document.createElement('div');
    cell.classList.add('grid-cell');
    gridBackground.appendChild(cell);
}

bestScoreEl.innerText = bestScore;

function initGame() {
    board = Array(4).fill().map(() => Array(4).fill(0));
    score = 0;
    undoStack = [];
    won = false;
    keepPlaying = false;
    updateScore();
    tileContainer.innerHTML = '';
    gameOverScreen.classList.add('hidden');
    gameWonScreen.classList.add('hidden');
    addRandomTile();
    addRandomTile();
    renderBoard();
}

function saveState() {
    undoStack.push({
        board: JSON.parse(JSON.stringify(board)),
        score: score
    });
    // Keep stack manageable
    if (undoStack.length > 20) undoStack.shift();
}

function undoMove() {
    if (undoStack.length === 0 || isAnimating) return;
    const previousState = undoStack.pop();
    board = previousState.board;
    score = previousState.score;
    updateScore();
    renderBoard();
    gameOverScreen.classList.add('hidden');
    gameWonScreen.classList.add('hidden');
}

function addRandomTile() {
    const emptyCells = [];
    for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
            if (board[r][c] === 0) emptyCells.push({r, c});
        }
    }
    if (emptyCells.length > 0) {
        const randomCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
        board[randomCell.r][randomCell.c] = Math.random() < 0.9 ? 2 : 4;
    }
}

function updateScore() {
    scoreEl.innerText = score;
    if (score > bestScore) {
        bestScore = score;
        bestScoreEl.innerText = bestScore;
        localStorage.setItem('2048-best', bestScore);
    }
}

function getTilePosition(r, c) {
    // Calculates absolute positioning based on CSS variables
    const gap = 15;
    const size = window.innerWidth <= 500 ? (document.querySelector('.game-container').offsetWidth - 55) / 4 : 100;
    const dynamicGap = window.innerWidth <= 500 ? 10 : gap;
    return {
        x: dynamicGap + c * (size + dynamicGap),
        y: dynamicGap + r * (size + dynamicGap),
        size: size
    };
}

function renderBoard() {
    tileContainer.innerHTML = '';
    for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
            if (board[r][c] !== 0) {
                createTileDOM(r, c, board[r][c]);
            }
        }
    }
}

function createTileDOM(r, c, value, isNew = false, isMerged = false) {
    const tile = document.createElement('div');
    tile.classList.add('tile');
    if (isNew) tile.classList.add('tile-new');
    if (isMerged) tile.classList.add('tile-merged');
    
    tile.innerText = value;
    tile.setAttribute('data-val', value);
    
    const pos = getTilePosition(r, c);
    tile.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
    tileContainer.appendChild(tile);
}

// Particle Logic
function triggerMergeParticles(r, c, value) {
    const pos = getTilePosition(r, c);
    const centerX = pos.x + pos.size / 2;
    const centerY = pos.y + pos.size / 2;
    
    // Map colors based on tile value
    const colors = {
        8: '#f2b179', 16: '#f59563', 32: '#f67c5f', 64: '#f65e3b',
        128: '#edcf72', 256: '#edcc61', 512: '#edc850', 1024: '#edc53f', 2048: '#edc22e'
    };
    const color = colors[value] || '#eee4da';

    for (let i = 0; i < 20; i++) {
        particles.push({
            x: centerX,
            y: centerY,
            vx: (Math.random() - 0.5) * 15,
            vy: (Math.random() - 0.5) * 15,
            size: Math.random() * 6 + 2,
            color: color,
            life: 1
        });
    }
    if (!isAnimatingParticles) animateParticles();
}

let isAnimatingParticles = false;
function animateParticles() {
    isAnimatingParticles = true;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let activeParticles = false;

    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.05;
        
        if (p.life > 0) {
            activeParticles = true;
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        } else {
            particles.splice(i, 1);
        }
    }
    
    if (activeParticles) {
        requestAnimationFrame(animateParticles);
    } else {
        isAnimatingParticles = false;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
}

// Movement Logic
function move(direction) {
    if (isAnimating) return;
    
    let boardChanged = false;
    let newBoard = JSON.parse(JSON.stringify(board));
    let mergeEvents = [];

    const rotateLeft = (matrix) => {
        return matrix[0].map((val, index) => matrix.map(row => row[index]).reverse());
    };
    const rotateRight = (matrix) => {
        return matrix[0].map((val, index) => matrix.map(row => row[row.length - 1 - index]));
    };

    // Normalize board so we only have to write "slide right" logic
    let rotations = 0;
    if (direction === 'Left') { rotations = 2; newBoard = rotateLeft(rotateLeft(newBoard)); }
    else if (direction === 'Up') { rotations = 3; newBoard = rotateRight(newBoard); }
    else if (direction === 'Down') { rotations = 1; newBoard = rotateLeft(newBoard); }

    // Slide Right Logic
    for (let r = 0; r < 4; r++) {
        let row = newBoard[r].filter(val => val !== 0);
        for (let c = row.length - 1; c > 0; c--) {
            if (row[c] === row[c - 1]) {
                row[c] *= 2;
                score += row[c];
                row[c - 1] = 0;
                
                // Calculate original coordinates for particle effect
                let origR = r, origC = 3 - (row.length - 1 - c);
                if (direction === 'Left') { origR = 3 - r; origC = 3 - origC; }
                else if (direction === 'Up') { let temp = origR; origR = origC; origC = 3 - temp; }
                else if (direction === 'Down') { let temp = origR; origR = 3 - origC; origC = temp; }
                
                mergeEvents.push({ r: origR, c: origC, val: row[c] });
                
                if (row[c] === 2048 && !keepPlaying) won = true;
            }
        }
        row = row.filter(val => val !== 0);
        while (row.length < 4) row.unshift(0);
        
        if (newBoard[r].join(',') !== row.join(',')) boardChanged = true;
        newBoard[r] = row;
    }

    // Un-rotate
    if (direction === 'Left') { newBoard = rotateRight(rotateRight(newBoard)); }
    else if (direction === 'Up') { newBoard = rotateLeft(newBoard); }
    else if (direction === 'Down') { newBoard = rotateRight(newBoard); }

    if (boardChanged) {
        saveState();
        board = newBoard;
        addRandomTile();
        updateScore();
        
        // Simple render (could be upgraded to CSS transform transitions for true sliding)
        renderBoard();
        
        mergeEvents.forEach(evt => triggerMergeParticles(evt.r, evt.c, evt.val));

        checkGameOver();
    }
}

function checkGameOver() {
    if (won && !keepPlaying) {
        gameWonScreen.classList.remove('hidden');
        return;
    }

    let hasMoves = false;
    for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
            if (board[r][c] === 0) hasMoves = true;
            if (r < 3 && board[r][c] === board[r + 1][c]) hasMoves = true;
            if (c < 3 && board[r][c] === board[r][c + 1]) hasMoves = true;
        }
    }

    if (!hasMoves) {
        gameOverScreen.classList.remove('hidden');
    }
}

// Input Handling
document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') { e.preventDefault(); move('Up'); }
    else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') { e.preventDefault(); move('Down'); }
    else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { e.preventDefault(); move('Left'); }
    else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { e.preventDefault(); move('Right'); }
});

// Swipe Handling
let touchStartX = 0, touchStartY = 0;
document.addEventListener('touchstart', e => {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
}, {passive: false});

document.addEventListener('touchend', e => {
    let touchEndX = e.changedTouches[0].screenX;
    let touchEndY = e.changedTouches[0].screenY;
    handleSwipe(touchStartX, touchStartY, touchEndX, touchEndY);
}, {passive: false});

// Prevent scrolling on mobile game container
document.querySelector('.game-container').addEventListener('touchmove', (e) => {
    e.preventDefault();
}, {passive: false});

function handleSwipe(startX, startY, endX, endY) {
    let dx = endX - startX;
    let dy = endY - startY;
    if (Math.abs(dx) < 30 && Math.abs(dy) < 30) return; // Ignore taps
    
    if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0) move('Right');
        else move('Left');
    } else {
        if (dy > 0) move('Down');
        else move('Up');
    }
}

// Button Listeners
restartBtn.addEventListener('click', initGame);
tryAgainBtn.addEventListener('click', initGame);
playAgainBtn.addEventListener('click', initGame);
undoBtn.addEventListener('click', undoMove);
keepGoingBtn.addEventListener('click', () => {
    keepPlaying = true;
    gameWonScreen.classList.add('hidden');
});

// Handle Window Resize for coordinate math
window.addEventListener('resize', () => {
    canvas.width = document.querySelector('.game-container').offsetWidth;
    canvas.height = document.querySelector('.game-container').offsetHeight;
    renderBoard();
});

// Start game
initGame();
