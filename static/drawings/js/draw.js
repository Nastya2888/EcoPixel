(() => {
    const canvas = document.getElementById("main-canvas");
    const gridCanvas = document.getElementById("grid-canvas");
    const cursorCanvas = document.getElementById("cursor-canvas");
    if (!canvas || !gridCanvas || !cursorCanvas) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const gridCtx = gridCanvas.getContext("2d");
    const cursorCtx = cursorCanvas.getContext("2d");
    const previewCanvas = document.getElementById("preview-canvas");
    const previewCtx = previewCanvas?.getContext("2d");
    const paletteEl = document.getElementById("palette");
    const customColorPicker = document.getElementById("customColorPicker");
    const addCustomColorBtn = document.getElementById("addCustomColor");
    const canvasContainer = document.querySelector(".canvas-container");
    const gridSizeInputs = document.querySelectorAll("input[name='grid-size']");
    const customWidthInput = document.getElementById("custom-width-input");
    const customHeightInput = document.getElementById("custom-height-input");
    const applyCustomSizeBtn = document.getElementById("apply-custom-size");
    const toolSizeRange = document.getElementById("tool-size-range");
    const toolSizeValue = document.getElementById("tool-size-value");
    const undoButton = document.getElementById("undo-button");
    const redoButton = document.getElementById("redo-button");
    const clearButton = document.getElementById("clear-button");
    const downloadButton = document.getElementById("download-btn");
    const submitButton = document.getElementById("submit-btn");
    const drawPage = document.querySelector(".draw-page");
    const authRequiredMessage = document.getElementById("auth-required-message");
    const toolButtons = document.querySelectorAll(".tool-btn[data-tool]");
    const currentSizeLabel = document.getElementById("canvas-size-badge");
    const currentColorLabel = document.getElementById("meta-color");
    const currentColorDot = document.getElementById("current-color-dot");
    const currentThicknessLabel = document.getElementById("meta-thickness");

    const modal = document.getElementById("submit-modal");
    const cancelSubmitBtn = document.getElementById("cancel-submit");
    const form = document.getElementById("submission-form");
    const ageInput = document.getElementById("age-input");
    const categoryAuto = document.getElementById("category-auto");
    const categorySlugInput = document.getElementById("category-slug-input");
    const errorsEl = document.getElementById("form-errors");
    const submitResultEl = document.getElementById("submit-result");
    const submitProgress = document.getElementById("submit-progress");
    const submitProgressText = document.getElementById("submit-progress-text");
    const submitProgressBar = document.getElementById("submit-progress-bar");
    const submitSuccess = document.getElementById("submit-success");
    const submitSuccessText = document.getElementById("submit-success-text");
    const copyLinkBtn = document.getElementById("copy-link-btn");
    const vkShareLink = document.getElementById("vk-share-link");
    const tgShareLink = document.getElementById("tg-share-link");

    if (!previewCanvas || !previewCtx || !paletteEl || !form) return;

    const PALETTE = [
        "#1B4332", "#FFFFFF", "#B7B7B7", "#F5F5DC",
        "#E07A5F", "#F2CC8F", "#E9C46A", "#D4A373",
        "#2ECC71", "#27AE60", "#52B788", "#8CB369",
        "#81C3D7", "#5B8DBE", "#6B5B95", "#DDA0DD",
        "#F4A261", "#E76F51", "#E5989B", "#264653",
    ];
    const COLOR_NAMES = {
        "#1B4332": "Графит",
        "#FFFFFF": "Белый",
        "#B7B7B7": "Серый",
        "#F5F5DC": "Песочный",
        "#E07A5F": "Коралл",
        "#F2CC8F": "Светло-желтый",
        "#E9C46A": "Золото",
        "#D4A373": "Охра",
        "#2ECC71": "Мятный",
        "#27AE60": "Травяной",
        "#52B788": "Зеленый",
        "#8CB369": "Оливковый",
        "#81C3D7": "Голубой",
        "#5B8DBE": "Синий",
        "#6B5B95": "Фиолетовый",
        "#DDA0DD": "Лавандовый",
        "#F4A261": "Оранжевый",
        "#E76F51": "Терракотовый",
        "#E5989B": "Розовый",
        "#264653": "Темно-синий",
    };

    const HISTORY_LIMIT = 20;
    const DRAFT_KEY = "ecopixel_draft";
    const CUSTOM_COLORS_KEY = "ecopixel_custom_colors";
    const MAX_CUSTOM_COLORS = 3;
    const EXPORT_TARGET_SIZE = 1024;
    const MIN_CUSTOM_GRID = 8;
    const MAX_CUSTOM_GRID = 128;
    const MIN_BRUSH_SIZE = 1;
    const MAX_BRUSH_SIZE = 12;

    let selectedColor = PALETTE[4];
    let selectedTool = "pencil";
    let brushSize = 1;
    let gridWidth = 32;
    let gridHeight = 32;
    let isDrawing = false;
    let isDrawingChanged = false;
    let history = [];
    let redoHistory = [];
    let activeSwatch = null;
    let customColors = [];
    let progressTimer = null;
    let lastSubmittedUrl = "";
    let dragStartPoint = null;
    let lastDrawPoint = null;
    let shapePreviewImageData = null;
    let lastHoverPoint = null;

    function normalizeHex(hex) {
        return String(hex || "").trim().toUpperCase();
    }

    function clampGridValue(value, fallback) {
        const parsed = Number.parseInt(String(value ?? ""), 10);
        if (!Number.isFinite(parsed)) return fallback;
        return Math.max(MIN_CUSTOM_GRID, Math.min(MAX_CUSTOM_GRID, parsed));
    }

    function clampBrushSize(value, fallback = 1) {
        const parsed = Number.parseInt(String(value ?? ""), 10);
        if (!Number.isFinite(parsed)) return fallback;
        return Math.max(MIN_BRUSH_SIZE, Math.min(MAX_BRUSH_SIZE, parsed));
    }

    function syncBrushSize(value) {
        brushSize = clampBrushSize(value, brushSize);
        if (toolSizeRange) toolSizeRange.value = String(brushSize);
        if (toolSizeValue) toolSizeValue.textContent = `${brushSize} px`;
        if (currentThicknessLabel) currentThicknessLabel.textContent = `${brushSize} px`;
    }

    function isShapeTool(tool) {
        return tool === "line" || tool === "rectangle" || tool === "circle";
    }

    function setCanvasCursorByTool(tool) {
        if (tool === "eyedropper") {
            canvas.style.cursor = "cell";
            return;
        }
        canvas.style.cursor = "crosshair";
    }

    function forEachBrushPixel(centerX, centerY, size, callback) {
        const normalizedSize = clampBrushSize(size, 1);
        const half = Math.floor(normalizedSize / 2);
        const startX = centerX - half;
        const startY = centerY - half;
        const endX = startX + normalizedSize - 1;
        const endY = startY + normalizedSize - 1;
        for (let py = startY; py <= endY; py += 1) {
            if (py < 0 || py >= gridHeight) continue;
            for (let px = startX; px <= endX; px += 1) {
                if (px < 0 || px >= gridWidth) continue;
                callback(px, py);
            }
        }
    }

    function paintBrushAt(x, y, color, size = brushSize) {
        ctx.fillStyle = color;
        forEachBrushPixel(x, y, size, (px, py) => {
            ctx.fillRect(px, py, 1, 1);
        });
    }

    function drawLineSegment(startX, startY, endX, endY, color, size = brushSize) {
        let x0 = startX;
        let y0 = startY;
        const dx = Math.abs(endX - x0);
        const dy = Math.abs(endY - y0);
        const sx = x0 < endX ? 1 : -1;
        const sy = y0 < endY ? 1 : -1;
        let err = dx - dy;

        while (true) {
            paintBrushAt(x0, y0, color, size);
            if (x0 === endX && y0 === endY) break;
            const e2 = err * 2;
            if (e2 > -dy) {
                err -= dy;
                x0 += sx;
            }
            if (e2 < dx) {
                err += dx;
                y0 += sy;
            }
        }
    }

    function drawRectangleOutline(start, end, color, size = brushSize) {
        const minX = Math.min(start.x, end.x);
        const maxX = Math.max(start.x, end.x);
        const minY = Math.min(start.y, end.y);
        const maxY = Math.max(start.y, end.y);
        drawLineSegment(minX, minY, maxX, minY, color, size);
        drawLineSegment(maxX, minY, maxX, maxY, color, size);
        drawLineSegment(maxX, maxY, minX, maxY, color, size);
        drawLineSegment(minX, maxY, minX, minY, color, size);
    }

    function drawCircleFromPoints(start, end, color, size = brushSize) {
        const radius = Math.round(Math.hypot(end.x - start.x, end.y - start.y));
        if (radius <= 0) {
            paintBrushAt(start.x, start.y, color, size);
            return;
        }
        const step = 1 / Math.max(radius * 10, 48);
        for (let angle = 0; angle <= Math.PI * 2; angle += step) {
            const x = Math.round(start.x + radius * Math.cos(angle));
            const y = Math.round(start.y + radius * Math.sin(angle));
            paintBrushAt(x, y, color, size);
        }
    }

    function drawShapeByTool(tool, start, end, color, size = brushSize) {
        if (tool === "line") {
            drawLineSegment(start.x, start.y, end.x, end.y, color, size);
            return;
        }
        if (tool === "rectangle") {
            drawRectangleOutline(start, end, color, size);
            return;
        }
        if (tool === "circle") {
            drawCircleFromPoints(start, end, color, size);
        }
    }

    function rgbaToHex(r, g, b) {
        return `#${[r, g, b].map((value) => value.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
    }

    function activateColor(colorHex) {
        const normalized = normalizeHex(colorHex);
        if (!/^#[0-9A-F]{6}$/.test(normalized)) return;

        if (!PALETTE.includes(normalized) && !customColors.includes(normalized)) {
            if (customColors.length >= MAX_CUSTOM_COLORS) customColors.shift();
            customColors.push(normalized);
            saveCustomColors();
            renderPalette();
        }

        const swatchButton = paletteEl.querySelector(`[data-color="${normalized}"]`);
        if (swatchButton) {
            setActiveSwatch(swatchButton, normalized);
            return;
        }
        selectedColor = normalized;
        updateStatusBar();
    }

    function getActiveDrawColor() {
        return selectedTool === "eraser" ? "#FFFFFF" : selectedColor;
    }

    function syncCustomInputs(width, height) {
        if (customWidthInput) customWidthInput.value = String(width);
        if (customHeightInput) customHeightInput.value = String(height);
    }

    function confirmResizeIfNeeded() {
        if (!isDrawingChanged) return true;
        return window.confirm("Текущий рисунок будет очищен. Продолжить?");
    }

    function setPresetSelection(width, height) {
        const matched = Array.from(gridSizeInputs).find(
            (el) => Number(el.value) === width && width === height
        );
        gridSizeInputs.forEach((el) => {
            el.checked = Boolean(matched && el === matched);
        });
    }

    function syncCanvasDisplaySize() {
        if (!canvasContainer) return;
        const rect = canvasContainer.getBoundingClientRect();
        const displayWidth = Math.floor(rect.width);
        const displayHeight = Math.floor(rect.height);
        if (!displayWidth || !displayHeight) return;
        canvas.style.width = `${displayWidth}px`;
        canvas.style.height = `${displayHeight}px`;
        gridCanvas.style.width = `${displayWidth}px`;
        gridCanvas.style.height = `${displayHeight}px`;
        cursorCanvas.style.width = `${displayWidth}px`;
        cursorCanvas.style.height = `${displayHeight}px`;
    }

    function initCanvas(nextWidth, nextHeight = nextWidth) {
        gridWidth = clampGridValue(nextWidth, 32);
        gridHeight = clampGridValue(nextHeight, 32);
        canvas.width = gridWidth;
        canvas.height = gridHeight;
        gridCanvas.width = gridWidth;
        gridCanvas.height = gridHeight;
        cursorCanvas.width = gridWidth;
        cursorCanvas.height = gridHeight;
        if (canvasContainer) {
            canvasContainer.style.aspectRatio = `${gridWidth} / ${gridHeight}`;
        }
        ctx.imageSmoothingEnabled = false;
        gridCtx.imageSmoothingEnabled = false;
        cursorCtx.imageSmoothingEnabled = false;
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, gridWidth, gridHeight);
        drawGrid();
        clearCursorHighlight();
        syncCanvasDisplaySize();
        syncCustomInputs(gridWidth, gridHeight);
        history = [];
        redoHistory = [];
        saveState(false);
        renderPreview();
        updateStatusBar();
        isDrawingChanged = false;
    }

    function saveState(clearRedo = true) {
        history.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
        if (history.length > HISTORY_LIMIT) history.shift();
        if (clearRedo) {
            redoHistory = [];
        }
    }

    function restoreState() {
        if (history.length <= 1) return;
        const currentState = history.pop();
        if (currentState) {
            redoHistory.push(currentState);
            if (redoHistory.length > HISTORY_LIMIT) redoHistory.shift();
        }
        const prev = history[history.length - 1];
        ctx.putImageData(prev, 0, 0);
        renderPreview();
        markChanged();
    }

    function redoState() {
        if (!redoHistory.length) return;
        const next = redoHistory.pop();
        if (!next) return;
        ctx.putImageData(next, 0, 0);
        history.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
        if (history.length > HISTORY_LIMIT) history.shift();
        renderPreview();
        markChanged();
    }

    function drawGrid() {
        gridCanvas.width = gridWidth;
        gridCanvas.height = gridHeight;
        gridCtx.clearRect(0, 0, gridWidth, gridHeight);
    }

    function renderPreview() {
        previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
        previewCtx.imageSmoothingEnabled = false;
        previewCtx.drawImage(canvas, 0, 0, previewCanvas.width, previewCanvas.height);
    }

    function getPointer(event) {
        if (event.touches?.[0]) return event.touches[0];
        if (event.changedTouches?.[0]) return event.changedTouches[0];
        return event;
    }

    function getCanvasPoint(event) {
        const { x, y } = getRawGridCoords(event);
        return {
            x: Math.max(0, Math.min(gridWidth - 1, x)),
            y: Math.max(0, Math.min(gridHeight - 1, y)),
        };
    }

    function getRawGridCoords(event) {
        const p = getPointer(event);
        const rect = canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return { x: -1, y: -1 };
        const scaleX = gridWidth / rect.width;
        const scaleY = gridHeight / rect.height;
        const x = Math.floor((p.clientX - rect.left) * scaleX);
        const y = Math.floor((p.clientY - rect.top) * scaleY);
        return { x, y };
    }

    function colorWithAlpha(hex, alphaHex) {
        const normalized = normalizeHex(hex);
        if (/^#[0-9A-F]{6}$/.test(normalized)) return `${normalized}${alphaHex}`;
        return "rgba(46, 204, 113, 0.8)";
    }

    function drawCursorHighlight(x, y) {
        lastHoverPoint = { x, y };
        cursorCtx.clearRect(0, 0, gridWidth, gridHeight);
        cursorCtx.imageSmoothingEnabled = false;
        cursorCtx.fillStyle = colorWithAlpha(getActiveDrawColor(), "CC");
        forEachBrushPixel(x, y, brushSize, (px, py) => {
            cursorCtx.fillRect(px, py, 1, 1);
        });
    }

    function clearCursorHighlight() {
        cursorCtx.clearRect(0, 0, gridWidth, gridHeight);
        lastHoverPoint = null;
    }

    function setPixel(x, y, color) {
        ctx.fillStyle = color;
        ctx.fillRect(x, y, 1, 1);
    }

    function hexToRgba(hex) {
        const value = hex.replace("#", "");
        const n = Number.parseInt(value, 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
    }

    function floodFill(startX, startY, fillColorHex) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const width = canvas.width;
        const height = canvas.height;

        const idx = (x, y) => (y * width + x) * 4;
        const targetIndex = idx(startX, startY);
        const targetColor = data.slice(targetIndex, targetIndex + 4);
        const fillColor = hexToRgba(fillColorHex);

        if (targetColor.every((c, i) => c === fillColor[i])) return;

        const stack = [{ x: startX, y: startY }];
        while (stack.length) {
            const { x, y } = stack.pop();
            if (x < 0 || y < 0 || x >= width || y >= height) continue;
            const i = idx(x, y);
            if (
                data[i] !== targetColor[0] ||
                data[i + 1] !== targetColor[1] ||
                data[i + 2] !== targetColor[2] ||
                data[i + 3] !== targetColor[3]
            ) continue;

            data[i] = fillColor[0];
            data[i + 1] = fillColor[1];
            data[i + 2] = fillColor[2];
            data[i + 3] = fillColor[3];

            stack.push({ x: x + 1, y });
            stack.push({ x: x - 1, y });
            stack.push({ x, y: y + 1 });
            stack.push({ x, y: y - 1 });
        }

        ctx.putImageData(imageData, 0, 0);
    }

    function markChanged() {
        isDrawingChanged = true;
    }

    function setTool(tool) {
        selectedTool = tool;
        toolButtons.forEach((button) => {
            button.classList.toggle("active", button.dataset.tool === tool);
        });
        setCanvasCursorByTool(tool);
        updateStatusBar();
    }

    function setActiveSwatch(button, color) {
        selectedColor = color;
        if (activeSwatch) activeSwatch.classList.remove("active");
        button.classList.add("active");
        button.animate([{ transform: "scale(1)" }, { transform: "scale(1.18)" }, { transform: "scale(1)" }], { duration: 180 });
        activeSwatch = button;
        updateStatusBar();
    }

    function createColorButton(color, isCustom = false) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `palette-color${isCustom ? " custom" : ""}`;
        button.style.backgroundColor = color;
        button.dataset.color = color;
        button.title = color;
        if (color === selectedColor) {
            button.classList.add("active");
            activeSwatch = button;
        }
        button.addEventListener("click", () => setActiveSwatch(button, color));
        return button;
    }

    function saveCustomColors() {
        localStorage.setItem(CUSTOM_COLORS_KEY, JSON.stringify(customColors));
    }

    function renderPalette() {
        paletteEl.innerHTML = "";
        PALETTE.forEach((color) => paletteEl.appendChild(createColorButton(color)));
        customColors.forEach((color) => paletteEl.appendChild(createColorButton(color, true)));
    }

    function updateStatusBar() {
        if (currentSizeLabel) currentSizeLabel.textContent = `${gridWidth} × ${gridHeight}`;
        if (currentColorLabel) currentColorLabel.textContent = COLOR_NAMES[selectedColor] || selectedColor;
        if (currentColorDot) currentColorDot.style.backgroundColor = selectedColor;
        if (currentThicknessLabel) currentThicknessLabel.textContent = `${brushSize} px`;
        if (toolSizeValue) toolSizeValue.textContent = `${brushSize} px`;
    }

    function pickColorAtPoint(point) {
        const pixel = ctx.getImageData(point.x, point.y, 1, 1).data;
        activateColor(rgbaToHex(pixel[0], pixel[1], pixel[2]));
    }

    function beginShapePreview(startPoint) {
        shapePreviewImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        dragStartPoint = startPoint;
        lastDrawPoint = startPoint;
    }

    function renderShapePreview(endPoint) {
        if (!shapePreviewImageData || !dragStartPoint) return;
        ctx.putImageData(shapePreviewImageData, 0, 0);
        drawShapeByTool(selectedTool, dragStartPoint, endPoint, getActiveDrawColor(), brushSize);
        lastDrawPoint = endPoint;
        renderPreview();
        markChanged();
    }

    function applyFreehandAtPoint(point) {
        const color = getActiveDrawColor();
        if (!lastDrawPoint) {
            drawLineSegment(point.x, point.y, point.x, point.y, color, brushSize);
            lastDrawPoint = point;
            return;
        }
        drawLineSegment(lastDrawPoint.x, lastDrawPoint.y, point.x, point.y, color, brushSize);
        lastDrawPoint = point;
    }

    function startDraw(event) {
        event.preventDefault();
        const point = getCanvasPoint(event);

        if (selectedTool === "eyedropper") {
            pickColorAtPoint(point);
            drawCursorHighlight(point.x, point.y);
            return;
        }

        if (selectedTool === "fill") {
            saveState();
            floodFill(point.x, point.y, selectedColor);
            saveState();
            renderPreview();
            markChanged();
            return;
        }

        isDrawing = true;
        saveState();

        if (isShapeTool(selectedTool)) {
            beginShapePreview(point);
            renderShapePreview(point);
            return;
        }

        dragStartPoint = point;
        lastDrawPoint = point;
        applyFreehandAtPoint(point);
        renderPreview();
        markChanged();
    }

    function moveDraw(event) {
        if (!isDrawing || selectedTool === "fill" || selectedTool === "eyedropper") return;
        if (event.cancelable) event.preventDefault();
        const point = getCanvasPoint(event);

        if (isShapeTool(selectedTool)) {
            renderShapePreview(point);
            return;
        }

        applyFreehandAtPoint(point);
        renderPreview();
        markChanged();
    }

    function finalizeShapeDraw(event) {
        const endPoint = event ? getCanvasPoint(event) : (lastDrawPoint || dragStartPoint);
        if (!shapePreviewImageData || !dragStartPoint || !endPoint) return;
        ctx.putImageData(shapePreviewImageData, 0, 0);
        drawShapeByTool(selectedTool, dragStartPoint, endPoint, getActiveDrawColor(), brushSize);
        renderPreview();
        markChanged();
    }

    function resetDragState() {
        dragStartPoint = null;
        lastDrawPoint = null;
        shapePreviewImageData = null;
    }

    function stopDraw(event) {
        if (!isDrawing) return;
        if (isShapeTool(selectedTool)) finalizeShapeDraw(event);
        saveState();
        isDrawing = false;
        resetDragState();
    }

    function clearCanvas() {
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        saveState();
        renderPreview();
        clearCursorHighlight();
        resetDragState();
        localStorage.removeItem(DRAFT_KEY);
        isDrawingChanged = false;
    }

    function getAutoCategoryByAge(age) {
        if (age >= 6 && age <= 9) return { name: "6–9 лет", slug: "age-6-9" };
        if (age >= 10 && age <= 13) return { name: "10–13 лет", slug: "age-10-13" };
        if (age >= 14 && age <= 17) return { name: "14–17 лет", slug: "age-14-17" };
        if (age >= 18 && age <= 25) return { name: "18–25 лет", slug: "age-18-25" };
        return { name: "", slug: "" };
    }

    function updateCategoryPreview() {
        const age = Number(ageInput.value);
        const category = getAutoCategoryByAge(age);
        categoryAuto.value = category.name;
        categorySlugInput.value = category.slug;
        categoryAuto.classList.toggle("has-value", Boolean(category.name));
    }

    function createUploadBlob() {
        return new Promise((resolve) => {
            const sourceWidth = Math.max(canvas.width, 1);
            const sourceHeight = Math.max(canvas.height, 1);
            const sourceMax = Math.max(sourceWidth, sourceHeight);
            const scale = Math.max(1, Math.floor(EXPORT_TARGET_SIZE / sourceMax));
            const exportWidth = sourceWidth * scale;
            const exportHeight = sourceHeight * scale;
            const exportCanvas = document.createElement("canvas");
            exportCanvas.width = exportWidth;
            exportCanvas.height = exportHeight;
            const exportCtx = exportCanvas.getContext("2d");
            if (!exportCtx) {
                resolve(null);
                return;
            }

            exportCtx.imageSmoothingEnabled = false;
            exportCtx.fillStyle = "#FFFFFF";
            exportCtx.fillRect(0, 0, exportWidth, exportHeight);
            exportCtx.drawImage(canvas, 0, 0, exportWidth, exportHeight);
            exportCanvas.toBlob(resolve, "image/png");
        });
    }

    function buildDownloadFileName() {
        const now = new Date();
        const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
        const timePart = `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
        return `ecopixel-${gridWidth}x${gridHeight}-${datePart}-${timePart}.png`;
    }

    function openModal() {
        const isAuthenticated = drawPage?.dataset.authenticated === "true";
        if (!isAuthenticated) {
            authRequiredMessage.innerHTML = 'Войди или зарегистрируйся, чтобы отправить работу. <a href="/login/?next=/draw/">Войти</a>';
            return;
        }
        authRequiredMessage.textContent = "";
        errorsEl.textContent = "";
        form.classList.remove("hidden");
        submitProgress.classList.add("hidden");
        submitSuccess.classList.add("hidden");
        modal.classList.remove("hidden");
        modal.classList.add("active");
        modal.setAttribute("aria-hidden", "false");
    }

    function closeModal() {
        modal.classList.remove("active");
        setTimeout(() => modal.classList.add("hidden"), 180);
        modal.setAttribute("aria-hidden", "true");
    }

    function startUploadProgress() {
        if (progressTimer) clearInterval(progressTimer);
        form.classList.add("hidden");
        submitSuccess.classList.add("hidden");
        submitProgress.classList.remove("hidden");
        submitProgressBar.style.width = "0%";
        submitProgressText.textContent = "Отправка...";
        let percent = 0;
        progressTimer = setInterval(() => {
            percent = Math.min(percent + 8, 92);
            submitProgressBar.style.width = `${percent}%`;
        }, 120);
    }

    function finishUploadProgress(success) {
        if (progressTimer) {
            clearInterval(progressTimer);
            progressTimer = null;
        }
        submitProgressBar.style.width = "100%";
        if (!success) {
            setTimeout(() => {
                submitProgress.classList.add("hidden");
                form.classList.remove("hidden");
            }, 240);
        }
    }

    function restoreDraftIfExists() {
        const draft = localStorage.getItem(DRAFT_KEY);
        if (!draft) return;
        if (!window.confirm("У вас есть несохраненный рисунок. Восстановить?")) return;
        const image = new Image();
        image.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
            saveState();
            renderPreview();
            markChanged();
        };
        image.src = draft;
    }

    function handleKeyboard(event) {
        const key = event.key.toLowerCase();
        const withCtrl = event.ctrlKey || event.metaKey;

        if (withCtrl && key === "z" && event.shiftKey) {
            event.preventDefault();
            redoState();
            return;
        }

        if (withCtrl && key === "z" && !event.shiftKey) {
            event.preventDefault();
            restoreState();
            return;
        }

        if (event.target && ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)) return;
        if (key === "b") setTool("pencil");
        if (key === "e") setTool("eraser");
        if (key === "f") setTool("fill");
        if (key === "l") setTool("line");
        if (key === "r") setTool("rectangle");
        if (key === "c") setTool("circle");
        if (key === "i") setTool("eyedropper");
    }

    toolButtons.forEach((button) => {
        button.addEventListener("click", () => setTool(button.dataset.tool));
    });

    undoButton?.addEventListener("click", restoreState);
    redoButton?.addEventListener("click", redoState);
    clearButton?.addEventListener("click", clearCanvas);
    addCustomColorBtn?.addEventListener("click", () => customColorPicker?.click());
    toolSizeRange?.addEventListener("input", (event) => {
        syncBrushSize(event.target.value);
        if (lastHoverPoint) drawCursorHighlight(lastHoverPoint.x, lastHoverPoint.y);
    });
    downloadButton?.addEventListener("click", async () => {
        const defaultLabel = "Скачать PNG";
        downloadButton.disabled = true;
        downloadButton.textContent = "Готовим PNG...";

        try {
            const blob = await createUploadBlob();
            if (!blob) {
                submitResultEl.textContent = "Не удалось подготовить файл для скачивания.";
                return;
            }

            const url = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = buildDownloadFileName();
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            URL.revokeObjectURL(url);

            submitResultEl.textContent = "PNG скачан.";
            window.setTimeout(() => {
                if (submitResultEl.textContent === "PNG скачан.") {
                    submitResultEl.textContent = "";
                }
            }, 2200);
        } catch (error) {
            submitResultEl.textContent = "Ошибка при скачивании PNG.";
        } finally {
            downloadButton.disabled = false;
            downloadButton.textContent = defaultLabel;
        }
    });

    gridSizeInputs.forEach((input) => {
        input.addEventListener("change", () => {
            if (!input.checked) return;
            if (!confirmResizeIfNeeded()) {
                setPresetSelection(gridWidth, gridHeight);
                return;
            }
            const value = clampGridValue(input.value, gridWidth);
            initCanvas(value, value);
            setPresetSelection(value, value);
        });
    });

    applyCustomSizeBtn?.addEventListener("click", () => {
        const nextWidth = clampGridValue(customWidthInput?.value, gridWidth);
        const nextHeight = clampGridValue(customHeightInput?.value, gridHeight);
        syncCustomInputs(nextWidth, nextHeight);
        if (nextWidth === gridWidth && nextHeight === gridHeight) return;
        if (!confirmResizeIfNeeded()) return;
        initCanvas(nextWidth, nextHeight);
        setPresetSelection(nextWidth, nextHeight);
    });

    [customWidthInput, customHeightInput].forEach((input) => {
        input?.addEventListener("keydown", (event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            applyCustomSizeBtn?.click();
        });
    });

    customColorPicker?.addEventListener("input", (event) => {
        const color = normalizeHex(event.target.value);
        if (!/^#[0-9A-F]{6}$/.test(color)) return;
        customColors = customColors.filter((item) => item !== color);
        if (customColors.length >= MAX_CUSTOM_COLORS) customColors.shift();
        customColors.push(color);
        saveCustomColors();
        renderPalette();
        const button = paletteEl.querySelector(`[data-color="${color}"]`);
        if (button) button.click();
    });

    submitButton?.addEventListener("click", openModal);
    cancelSubmitBtn?.addEventListener("click", closeModal);
    modal?.addEventListener("click", (event) => {
        if (event.target === modal) closeModal();
    });

    ageInput?.addEventListener("input", updateCategoryPreview);

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        errorsEl.textContent = "";
        submitResultEl.textContent = "";
        startUploadProgress();

        const blob = await createUploadBlob();
        if (!blob) {
            finishUploadProgress(false);
            errorsEl.textContent = "Не удалось подготовить изображение.";
            return;
        }

        const formData = new FormData(form);
        formData.set("image", new File([blob], "drawing.png", { type: "image/png" }));

        try {
            const response = await fetch(form.dataset.submitUrl, {
                method: "POST",
                body: formData,
                headers: {
                    "X-CSRFToken": form.querySelector("[name=csrfmiddlewaretoken]").value,
                    "X-Requested-With": "XMLHttpRequest",
                },
                credentials: "same-origin",
            });

            const data = await response.json();
            if (!response.ok || !data.success) {
                finishUploadProgress(false);
                errorsEl.textContent = data.error || "Не удалось отправить работу.";
                if (response.status === 403) {
                    errorsEl.innerHTML = `${data.error || "Требуется авторизация."} <a href="/login/?next=/draw/">Войти</a>`;
                }
                return;
            }

            finishUploadProgress(true);
            localStorage.removeItem(DRAFT_KEY);
            isDrawingChanged = false;
            lastSubmittedUrl = `${window.location.origin}/work/${data.id}/`;
            submitProgressText.textContent = "Готово!";
            submitSuccess.classList.remove("hidden");
            submitSuccessText.textContent = `Готово! Номер работы: #${data.id}`;
            vkShareLink.href = `https://vk.com/share.php?url=${encodeURIComponent(lastSubmittedUrl)}`;
            tgShareLink.href = `https://t.me/share/url?url=${encodeURIComponent(lastSubmittedUrl)}&text=${encodeURIComponent("Мой рисунок на конкурсе ЭкоПиксель!")}`;
            submitResultEl.innerHTML = `Рисунок принят! Номер работы: #${data.id}. <a href="/work/${data.id}/">Открыть работу</a>`;
            form.reset();
            updateCategoryPreview();
        } catch (error) {
            finishUploadProgress(false);
            errorsEl.textContent = "Ошибка сети при отправке формы.";
        }
    });

    copyLinkBtn?.addEventListener("click", async () => {
        if (!lastSubmittedUrl) return;
        try {
            await navigator.clipboard.writeText(lastSubmittedUrl);
            copyLinkBtn.textContent = "Ссылка скопирована";
            setTimeout(() => {
                copyLinkBtn.textContent = "Скопировать ссылку";
            }, 1500);
        } catch (error) {
            copyLinkBtn.textContent = "Не удалось скопировать";
        }
    });

    canvas.addEventListener("mousedown", startDraw);
    canvas.addEventListener("mousemove", (event) => {
        const { x, y } = getRawGridCoords(event);
        if (x >= 0 && x < gridWidth && y >= 0 && y < gridHeight) {
            drawCursorHighlight(x, y);
        } else {
            clearCursorHighlight();
        }
    });
    canvas.addEventListener("mousemove", moveDraw);
    canvas.addEventListener("mouseleave", clearCursorHighlight);
    window.addEventListener("mouseup", stopDraw);
    canvas.addEventListener("mouseleave", stopDraw);
    canvas.addEventListener("touchstart", startDraw, { passive: false });
    canvas.addEventListener("touchmove", moveDraw, { passive: false });
    canvas.addEventListener("touchend", stopDraw, { passive: false });
    canvas.addEventListener("touchcancel", stopDraw, { passive: false });

    window.addEventListener("keydown", handleKeyboard);
    window.addEventListener("resize", syncCanvasDisplaySize);

    setInterval(() => {
        if (!isDrawingChanged) return;
        try {
            localStorage.setItem(DRAFT_KEY, canvas.toDataURL("image/png"));
        } catch (error) {
            // Ignore storage write errors.
        }
    }, 10000);

    window.addEventListener("beforeunload", (event) => {
        if (!isDrawingChanged) return;
        event.preventDefault();
        event.returnValue = "";
    });

    try {
        const parsed = JSON.parse(localStorage.getItem(CUSTOM_COLORS_KEY) || "[]");
        if (Array.isArray(parsed)) {
            customColors = parsed
                .map((value) => normalizeHex(value))
                .filter((value) => /^#[0-9A-F]{6}$/.test(value))
                .slice(-MAX_CUSTOM_COLORS);
        }
    } catch (error) {
        customColors = [];
    }

    renderPalette();
    syncBrushSize(brushSize);
    initCanvas(32, 32);
    setPresetSelection(32, 32);
    updateCategoryPreview();
    restoreDraftIfExists();
    setTool("pencil");
})();
