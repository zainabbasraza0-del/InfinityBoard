const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const aiToolbar = document.getElementById('aiToolbar');
const actionBtns = document.querySelectorAll('.action-btn');
const colorPicker = document.getElementById('colorPicker');
const sizeSlider = document.getElementById('sizeSlider');
const pageIndicator = document.getElementById('pageIndicator');

let camera = { x: 0, y: 0, zoom: 1 };
let currentTool = 'pen';
let bgConfig = { type: 'preset', value: 'dots', img: null };

let isInteracting = false;
let isSpacePressed = false;
let isPanning = false;

let startX = 0;
let startY = 0;
let lastX = 0;
let lastY = 0;
let panStartX = 0;
let panStartY = 0;

let objects = [];
let selectedObject = null;
let liveDrawingObject = null;
let activeTextInput = null;

let undoStack = [[]];
let redoStack = [];
let pages = [{ 
    objects: [], 
    bgConfig: { type: 'preset', value: 'dots', img: null }, 
    undoStack: [[]], 
    redoStack: [], 
    camera: { x: 0, y: 0, zoom: 1 } 
}];
let currentPageIndex = 0;

function scaleCanvasForHighDPI() {
    const dpr = window.devicePixelRatio || 1;
    
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    
    redrawCanvas();
}

function getScreenToWorld(screenX, screenY) {
    return {
        x: (screenX - camera.x) / camera.zoom,
        y: (screenY - camera.y) / camera.zoom
    };
}

function getBoundingBox() {
    if (objects.length === 0) return null;
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    objects.forEach(obj => {
        switch (obj.type) {
            case 'rect':
            case 'line':
                minX = Math.min(minX, obj.x, obj.x + obj.w);
                maxX = Math.max(maxX, obj.x, obj.x + obj.w);
                minY = Math.min(minY, obj.y, obj.y + obj.h);
                maxY = Math.max(maxY, obj.y, obj.y + obj.h);
                break;
            case 'circle':
                minX = Math.min(minX, obj.x - obj.r);
                maxX = Math.max(maxX, obj.x + obj.r);
                minY = Math.min(minY, obj.y - obj.r);
                maxY = Math.max(maxY, obj.y + obj.r);
                break;
            case 'pen':
            case 'highlighter':
            case 'smartpen':
                obj.points.forEach(p => {
                    minX = Math.min(minX, p.x - obj.size);
                    maxX = Math.max(maxX, p.x + obj.size);
                    minY = Math.min(minY, p.y - obj.size);
                    maxY = Math.max(maxY, p.y + obj.size);
                });
                break;
            case 'text':
                ctx.save();
                ctx.font = `${obj.fontSize}px -apple-system, BlinkMacSystemFont`;
                const textWidth = ctx.measureText(obj.text).width;
                ctx.restore();
                
                minX = Math.min(minX, obj.x);
                maxX = Math.max(maxX, obj.x + textWidth);
                minY = Math.min(minY, obj.y);
                maxY = Math.max(maxY, obj.y + obj.fontSize);
                break;
        }
    });
    
    return { minX, minY, maxX, maxY };
}

function getObjectAtPosition(mx, my) {
    for (let i = objects.length - 1; i >= 0; i--) {
        const obj = objects[i];
        
        if (obj.type === 'rect') {
            const minX = Math.min(obj.x, obj.x + obj.w);
            const maxX = Math.max(obj.x, obj.x + obj.w);
            const minY = Math.min(obj.y, obj.y + obj.h);
            const maxY = Math.max(obj.y, obj.y + obj.h);
            
            if (mx >= minX && mx <= maxX && my >= minY && my <= maxY) return obj;
        } 
        else if (obj.type === 'circle') {
            const dist = Math.sqrt(Math.pow(mx - obj.x, 2) + Math.pow(my - obj.y, 2));
            if (dist <= obj.r) return obj;
        } 
        else if (['pen', 'highlighter'].includes(obj.type)) {
            const padding = obj.size + 4;
            for (const p of obj.points) {
                const dist = Math.sqrt(Math.pow(mx - p.x, 2) + Math.pow(my - p.y, 2));
                if (dist <= padding) return obj;
            }
        } 
        else if (obj.type === 'line') {
            const minX = Math.min(obj.x, obj.x + obj.w) - 10;
            const maxX = Math.max(obj.x, obj.x + obj.w) + 10;
            const minY = Math.min(obj.y, obj.y + obj.h) - 10;
            const maxY = Math.max(obj.y, obj.y + obj.h) + 10;
            
            if (mx >= minX && mx <= maxX && my >= minY && my <= maxY) return obj;
        } 
        else if (obj.type === 'text') {
            ctx.save();
            ctx.font = `${obj.fontSize}px -apple-system, BlinkMacSystemFont`;
            const textWidth = ctx.measureText(obj.text).width;
            ctx.restore();
            
            if (mx >= obj.x && mx <= obj.x + textWidth && my >= obj.y && my <= obj.y + obj.fontSize) {
                return obj;
            }
        }
    }
    return null;
}

function recognizeShape(points, color, size) {
    if (points.length < 15) {
        return { type: 'pen', points, color, size };
    }

    const start = points[0];
    const end = points[points.length - 1];
    
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let pathLength = 0;

    for (let i = 0; i < points.length; i++) {
        minX = Math.min(minX, points[i].x);
        maxX = Math.max(maxX, points[i].x);
        minY = Math.min(minY, points[i].y);
        maxY = Math.max(maxY, points[i].y);
        
        if (i > 0) {
            const dx = points[i].x - points[i-1].x;
            const dy = points[i].y - points[i-1].y;
            pathLength += Math.sqrt(dx * dx + dy * dy);
        }
    }

    const w = maxX - minX;
    const h = maxY - minY;
    
    const straightDistance = Math.sqrt(Math.pow(maxX - minX, 2) + Math.pow(maxY - minY, 2));
    
    if (pathLength / straightDistance < 1.15) {
        return { 
            type: 'line', 
            x: start.x, 
            y: start.y, 
            w: end.x - start.x, 
            h: end.y - start.y, 
            color, 
            size 
        };
    }

    const closureGap = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
    const isClosed = closureGap < (Math.max(w, h) * 0.3);

    if (isClosed) {
        const ratio = Math.max(w, h) / Math.min(w, h);
        if (ratio < 1.3) {
            return { 
                type: 'circle', 
                x: minX + w / 2, 
                y: minY + h / 2, 
                r: Math.max(w, h) / 2, 
                color, 
                size 
            };
        } else {
            return { type: 'rect', x: minX, y: minY, w, h, color, size };
        }
    }
    
    return { type: 'pen', points, color, size };
}

function updateAIToolbar() {
    if (currentTool === 'select' && selectedObject?.type === 'text') {
        const screenX = (selectedObject.x * camera.zoom) + camera.x;
        const screenY = (selectedObject.y * camera.zoom) + camera.y;
        
        ctx.save();
        ctx.font = `${selectedObject.fontSize}px -apple-system`;
        const textWidth = ctx.measureText(selectedObject.text).width * camera.zoom;
        ctx.restore();

        aiToolbar.style.display = 'flex';
        aiToolbar.style.left = `${screenX + (textWidth / 2)}px`;
        aiToolbar.style.top = `${screenY - 15}px`;
    } else {
        aiToolbar.style.display = 'none';
    }
}

function spawnTextInput(screenX, screenY, worldX, worldY) {
    if (activeTextInput) commitTextInput();
    
    const input = document.createElement('input');
    const calculatedSize = parseInt(sizeSlider.value, 10) * 4;
    
    input.type = 'text';
    input.style.position = 'fixed';
    input.style.left = `${screenX}px`;
    input.style.top = `${screenY}px`;
    input.style.font = `${calculatedSize * camera.zoom}px -apple-system, BlinkMacSystemFont`;
    input.style.color = colorPicker.value;
    input.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
    input.style.border = '2px dashed #94a3b8';
    input.style.borderRadius = '4px';
    input.style.padding = '4px 8px';
    input.style.width = '250px';
    input.style.outline = 'none';
    input.style.zIndex = '2000';
    input.style.margin = '0';
    
    input.dataset.worldX = worldX;
    input.dataset.worldY = worldY;
    input.dataset.fontSize = calculatedSize;
    
    document.body.appendChild(input);
    
    setTimeout(() => input.focus(), 10);
    activeTextInput = input;
    
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            commitTextInput();
        } else if (e.key === 'Escape') {
            input.remove();
            activeTextInput = null;
            redrawCanvas();
        }
    });
    
    input.addEventListener('blur', () => {
        setTimeout(() => {
            if (activeTextInput === input) commitTextInput();
        }, 100);
    });
}

function commitTextInput() {
    if (!activeTextInput) return;
    
    const textValue = activeTextInput.value.trim();
    
    if (textValue.length > 0) {
        objects.push({
            type: 'text',
            text: textValue,
            x: parseFloat(activeTextInput.dataset.worldX),
            y: parseFloat(activeTextInput.dataset.worldY),
            fontSize: parseFloat(activeTextInput.dataset.fontSize),
            color: activeTextInput.style.color
        });
        saveHistoryState();
    }
    
    activeTextInput.remove();
    activeTextInput = null;
    redrawCanvas();
}

function drawBackground() {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    
    switch (bgConfig.value) {
        case 'dark':
            ctx.fillStyle = '#1e293b';
            break;
        case 'blueprint':
            ctx.fillStyle = '#1e3a8a';
            break;
        default:
            ctx.fillStyle = bgConfig.type === 'color' ? bgConfig.value : '#f8fafc';
    }
    
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    if (bgConfig.type === 'image' && bgConfig.img) {
        ctx.drawImage(bgConfig.img, 0, 0);
        return;
    }

    const gridSize = 40;
    const left = -camera.x / camera.zoom;
    const top = -camera.y / camera.zoom;
    const right = left + window.innerWidth / camera.zoom;
    const bottom = top + window.innerHeight / camera.zoom;
    
    const startXGrid = Math.floor(left / gridSize) * gridSize;
    const startYGrid = Math.floor(top / gridSize) * gridSize;

    if (bgConfig.value === 'dots') {
        ctx.fillStyle = '#cbd5e1';
        for (let x = startXGrid; x < right; x += gridSize) {
            for (let y = startYGrid; y < bottom; y += gridSize) {
                ctx.beginPath();
                ctx.arc(x, y, 1.5 / camera.zoom, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    } 
    else if (bgConfig.value === 'grid' || bgConfig.value === 'blueprint') {
        ctx.strokeStyle = bgConfig.value === 'blueprint' ? 'rgba(255,255,255,0.15)' : '#e2e8f0';
        ctx.lineWidth = 1 / camera.zoom;
        
        for (let x = startXGrid; x < right; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, top);
            ctx.lineTo(x, bottom);
            ctx.stroke();
        }
        for (let y = startYGrid; y < bottom; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(left, y);
            ctx.lineTo(right, y);
            ctx.stroke();
        }
    } 
    else if (bgConfig.value === 'lined') {
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1 / camera.zoom;
        for (let y = startYGrid; y < bottom; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(left, y);
            ctx.lineTo(right, y);
            ctx.stroke();
        }
    }
}

function drawObject(context, obj) {
    context.save();
    context.beginPath();
    context.strokeStyle = obj.color;
    context.lineWidth = obj.size;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    
    if (obj.type === 'highlighter') {
        context.globalAlpha = 0.4;
    }
    
    if (obj === selectedObject) {
        context.shadowColor = '#3b82f6';
        context.shadowBlur = 10 / camera.zoom;
    } else {
        context.shadowBlur = 0;
    }

    if (['pen', 'highlighter', 'smartpen'].includes(obj.type) && obj.points.length > 0) {
        context.moveTo(obj.points[0].x, obj.points[0].y);
        for (let i = 1; i < obj.points.length; i++) {
            context.lineTo(obj.points[i].x, obj.points[i].y);
        }
        context.stroke();
    } 
    else if (obj.type === 'rect') {
        context.strokeRect(obj.x, obj.y, obj.w, obj.h);
    } 
    else if (obj.type === 'circle') {
        context.arc(obj.x, obj.y, obj.r, 0, 2 * Math.PI);
        context.stroke();
    } 
    else if (obj.type === 'line') {
        context.moveTo(obj.x, obj.y);
        context.lineTo(obj.x + obj.w, obj.y + obj.h);
        context.stroke();
    } 
    else if (obj.type === 'text') {
        context.fillStyle = obj.color;
        
        const isDarkTheme = ['dark', 'blueprint'].includes(bgConfig.value);
        if (isDarkTheme && obj.color === '#0f172a') {
            context.fillStyle = '#ffffff';
        }
        
        context.font = `${obj.fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
        context.textBaseline = 'top';
        context.fillText(obj.text, obj.x, obj.y);
    }
    
    context.restore();
}

function redrawCanvas() {
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    
    ctx.save();
    ctx.translate(camera.x, camera.y);
    ctx.scale(camera.zoom, camera.zoom);
    
    drawBackground();
    objects.forEach(obj => drawObject(ctx, obj));
    
    if (liveDrawingObject) {
        drawObject(ctx, liveDrawingObject);
    }
    
    ctx.restore();
    updateAIToolbar();
}

document.querySelectorAll('.ai-action-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
        if (!selectedObject || selectedObject.type !== 'text') return;
        
        const action = e.target.dataset.action;
        const originalText = selectedObject.text;
        const originalColor = selectedObject.color;

        selectedObject.color = '#8b5cf6';
        selectedObject.text = "✨ AI is thinking...";
        aiToolbar.style.display = 'none';
        redrawCanvas();

        await new Promise(resolve => setTimeout(resolve, 1500));

        switch (action) {
            case 'summarize':
                selectedObject.text = `Summary: ${originalText.substring(0, 15)}...`;
                break;
            case 'professional':
                selectedObject.text = `Regarding the matter: ${originalText}`;
                break;
            case 'idea':
                selectedObject.text = `${originalText} 💡 (Here is a related thought!)`;
                break;
        }

        selectedObject.color = originalColor;
        saveHistoryState();
        redrawCanvas();
    });
});

actionBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelector('.action-btn.active')?.classList.remove('active');
        btn.classList.add('active');
        
        currentTool = btn.id.replace('Btn', '');
        
        if (currentTool !== 'select') selectedObject = null;
        if (activeTextInput) commitTextInput();
        
        redrawCanvas();
    });
});

document.getElementById('clearBtn').addEventListener('click', () => {
    if (activeTextInput) {
        activeTextInput.remove();
        activeTextInput = null;
    }
    objects = [];
    selectedObject = null;
    saveHistoryState();
    redrawCanvas();
});

document.querySelectorAll('.bg-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        bgConfig = { type: 'preset', value: e.target.dataset.bg, img: null };
        redrawCanvas();
    });
});

document.getElementById('bgColorPicker').addEventListener('input', (e) => {
    bgConfig = { type: 'color', value: e.target.value, img: null };
    redrawCanvas();
});

document.getElementById('bgImageInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                bgConfig = { type: 'image', value: 'custom', img: img };
                redrawCanvas();
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }
});

canvas.addEventListener('mousedown', (e) => {
    if (isSpacePressed || e.button === 1) {
        isPanning = true;
        panStartX = e.clientX - camera.x;
        panStartY = e.clientY - camera.y;
        canvas.style.cursor = 'grabbing';
        return;
    }

    const worldPos = getScreenToWorld(e.clientX, e.clientY);
    startX = lastX = worldPos.x;
    startY = lastY = worldPos.y;

    if (currentTool === 'text') {
        return spawnTextInput(e.clientX, e.clientY, worldPos.x, worldPos.y);
    }
    
    if (activeTextInput) commitTextInput();
    
    isInteracting = true;

    if (currentTool === 'select') {
        selectedObject = getObjectAtPosition(startX, startY);
        redrawCanvas();
    } 
    else if (currentTool === 'eraser') {
        const target = getObjectAtPosition(startX, startY);
        if (target) {
            objects = objects.filter(obj => obj !== target);
            saveHistoryState();
            redrawCanvas();
        }
    } 
    else if (['pen', 'highlighter', 'smartpen'].includes(currentTool)) {
        liveDrawingObject = {
            type: currentTool,
            points: [{ x: startX, y: startY }],
            color: colorPicker.value,
            size: parseInt(sizeSlider.value, 10)
        };
        redrawCanvas();
    } 
    else if (['rect', 'circle', 'line'].includes(currentTool)) {
        liveDrawingObject = {
            type: currentTool,
            x: startX,
            y: startY,
            w: 0,
            h: 0,
            r: 0,
            color: colorPicker.value,
            size: parseInt(sizeSlider.value, 10)
        };
        redrawCanvas();
    }
});

canvas.addEventListener('mousemove', (e) => {
    if (isPanning) {
        camera.x = e.clientX - panStartX;
        camera.y = e.clientY - panStartY;
        redrawCanvas();
        return;
    }
    
    if (!isInteracting) return;
    
    const worldPos = getScreenToWorld(e.clientX, e.clientY);

    if (currentTool === 'select' && selectedObject) {
        const dx = worldPos.x - lastX;
        const dy = worldPos.y - lastY;
        
        if (['pen', 'highlighter'].includes(selectedObject.type)) {
            selectedObject.points.forEach(p => {
                p.x += dx;
                p.y += dy;
            });
        } else {
            selectedObject.x += dx;
            selectedObject.y += dy;
        }
        
        lastX = worldPos.x;
        lastY = worldPos.y;
        redrawCanvas();
    } 
    else if (['pen', 'highlighter', 'smartpen'].includes(currentTool) && liveDrawingObject) {
        const lastPt = liveDrawingObject.points[liveDrawingObject.points.length - 1];
        const dist = Math.sqrt(Math.pow(worldPos.x - lastPt.x, 2) + Math.pow(worldPos.y - lastPt.y, 2));
        
        if (dist > 2) {
            liveDrawingObject.points.push({ x: worldPos.x, y: worldPos.y });
            redrawCanvas();
        }
    } 
    else if (['rect', 'circle', 'line'].includes(currentTool) && liveDrawingObject) {
        if (liveDrawingObject.type === 'rect' || liveDrawingObject.type === 'line') {
            liveDrawingObject.w = worldPos.x - startX;
            liveDrawingObject.h = worldPos.y - startY;
        } else if (liveDrawingObject.type === 'circle') {
            liveDrawingObject.r = Math.sqrt(Math.pow(worldPos.x - startX, 2) + Math.pow(worldPos.y - startY, 2));
        }
        redrawCanvas();
    }
});

canvas.addEventListener('mouseup', () => {
    if (isPanning) {
        isPanning = false;
        canvas.style.cursor = isSpacePressed ? 'grab' : 'crosshair';
        return;
    }
    
    if (!isInteracting) return;
    isInteracting = false;
    
    if (currentTool === 'select' && selectedObject) {
        saveHistoryState();
    } 
    else if (liveDrawingObject) {
        if (currentTool === 'smartpen') {
            const aiShape = recognizeShape(
                liveDrawingObject.points, 
                liveDrawingObject.color, 
                liveDrawingObject.size
            );
            objects.push(aiShape);
        } else {
            objects.push(liveDrawingObject);
        }
        
        liveDrawingObject = null;
        saveHistoryState();
        redrawCanvas();
    }
});

canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (activeTextInput) commitTextInput();
    
    const newZoom = Math.min(Math.max(camera.zoom * Math.exp(-e.deltaY * 0.0015), 0.1), 10);
    const worldPos = getScreenToWorld(e.clientX, e.clientY);
    
    camera.zoom = newZoom;
    camera.x = e.clientX - (worldPos.x * camera.zoom);
    camera.y = e.clientY - (worldPos.y * camera.zoom);
    
    redrawCanvas();
}, { passive: false });

window.addEventListener('keydown', (e) => {
    if (document.activeElement.tagName === 'INPUT') return;
    
    if (e.code === 'Space' && !isSpacePressed) {
        e.preventDefault();
        isSpacePressed = true;
        canvas.style.cursor = 'grab';
    }
    
    if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === 'z') {
            e.preventDefault();
            undo();
        }
        if (e.key.toLowerCase() === 'y') {
            e.preventDefault();
            redo();
        }
    }
});

window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
        isSpacePressed = false;
        if (!isPanning) canvas.style.cursor = 'crosshair';
    }
});

function saveHistoryState() {
    undoStack.push(JSON.parse(JSON.stringify(objects)));
    redoStack = [];
}

function undo() {
    if (undoStack.length > 1) {
        redoStack.push(undoStack.pop());
        objects = JSON.parse(JSON.stringify(undoStack[undoStack.length - 1]));
        selectedObject = null;
        redrawCanvas();
    }
}

function redo() {
    if (redoStack.length > 0) {
        const nextState = redoStack.pop();
        undoStack.push(nextState);
        objects = JSON.parse(JSON.stringify(nextState));
        selectedObject = null;
        redrawCanvas();
    }
}

document.getElementById('undoBtn').addEventListener('click', undo);
document.getElementById('redoBtn').addEventListener('click', redo);

function saveCurrentPageData() {
    pages[currentPageIndex] = {
        objects: JSON.parse(JSON.stringify(objects)),
        bgConfig: { ...bgConfig },
        undoStack: JSON.parse(JSON.stringify(undoStack)),
        redoStack: JSON.parse(JSON.stringify(redoStack)),
        camera: { ...camera }
    };
}

function loadPage(index) {
    if (activeTextInput) commitTextInput();
    saveCurrentPageData();
    
    currentPageIndex = index;
    const p = pages[currentPageIndex];
    
    objects = JSON.parse(JSON.stringify(p.objects));
    bgConfig = { ...p.bgConfig };
    undoStack = JSON.parse(JSON.stringify(p.undoStack));
    redoStack = JSON.parse(JSON.stringify(p.redoStack));
    camera = { ...p.camera };
    selectedObject = null;
    
    pageIndicator.innerText = `${currentPageIndex + 1} / ${pages.length}`;
    redrawCanvas();
}

document.getElementById('prevPageBtn').addEventListener('click', () => {
    if (currentPageIndex > 0) loadPage(currentPageIndex - 1);
});

document.getElementById('nextPageBtn').addEventListener('click', () => {
    if (currentPageIndex < pages.length - 1) loadPage(currentPageIndex + 1);
});

document.getElementById('addPageBtn').addEventListener('click', () => {
    saveCurrentPageData();
    pages.push({
        objects: [],
        bgConfig: { type: 'preset', value: 'dots', img: null },
        undoStack: [[]],
        redoStack: [],
        camera: { x: 0, y: 0, zoom: 1 }
    });
    loadPage(pages.length - 1);
});

document.getElementById('exportBtn').addEventListener('click', () => {
    const bounds = getBoundingBox();
    if (!bounds) {
        alert("The board is empty! Draw something first before exporting.");
        return;
    }
    
    const padding = 50;
    const exportWidth = bounds.maxX - bounds.minX + (padding * 2);
    const exportHeight = bounds.maxY - bounds.minY + (padding * 2);
    const exportCanvas = document.createElement('canvas');
    const exportCtx = exportCanvas.getContext('2d');
    const scaleMultiplier = 2;
    
    exportCanvas.width = exportWidth * scaleMultiplier;
    exportCanvas.height = exportHeight * scaleMultiplier;
    exportCtx.scale(scaleMultiplier, scaleMultiplier);
    exportCtx.translate(-bounds.minX + padding, -bounds.minY + padding);
    
    exportCtx.save();
    exportCtx.setTransform(1, 0, 0, 1, 0, 0);
    
    switch (bgConfig.value) {
        case 'dark':
            exportCtx.fillStyle = '#1e293b';
            break;
        case 'blueprint':
            exportCtx.fillStyle = '#1e3a8a';
            break;
        default:
            exportCtx.fillStyle = bgConfig.type === 'color' ? bgConfig.value : '#f8fafc';
    }
    
    exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    exportCtx.restore();
    
    if (bgConfig.type === 'image' && bgConfig.img) {
        exportCtx.drawImage(bgConfig.img, 0, 0);
    }
    
    objects.forEach(obj => drawObject(exportCtx, obj));
    
    const link = document.createElement('a');
    link.download = `InfinityBoard-Export-${Date.now()}.png`;
    link.href = exportCanvas.toDataURL('image/png');
    link.click();
});

scaleCanvasForHighDPI();
window.addEventListener('resize', scaleCanvasForHighDPI);
