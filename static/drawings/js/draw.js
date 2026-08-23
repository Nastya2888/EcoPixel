(() => {
    const canvas = document.getElementById("main-canvas");
    const templateCanvas = document.getElementById("template-canvas");
    const gridCanvas = document.getElementById("grid-canvas");
    const cursorCanvas = document.getElementById("cursor-canvas");
    if (!canvas || !templateCanvas || !gridCanvas || !cursorCanvas) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const templateCtx = templateCanvas.getContext("2d");
    const gridCtx = gridCanvas.getContext("2d");
    const cursorCtx = cursorCanvas.getContext("2d");
    const previewCanvas = document.getElementById("preview-canvas");
    const previewCtx = previewCanvas?.getContext("2d");
    const paletteEl = document.getElementById("palette");
    const customColorPicker = document.getElementById("customColorPicker");
    const addCustomColorBtn = document.getElementById("addCustomColor");
    const canvasContainer = document.querySelector(".canvas-container");
    const canvasStage = document.querySelector(".canvas-stage");
    const canvasViewport = document.getElementById("canvas-viewport");
    const zoomLabel = document.getElementById("meta-zoom");
    const sidebarTabs = document.querySelectorAll(".sidebar-tab");
    const sidebarPanels = document.querySelectorAll(".sidebar-panel");
    const gridSizeInputs = document.querySelectorAll("input[name='grid-size']");
    const customWidthInput = document.getElementById("custom-width-input");
    const customHeightInput = document.getElementById("custom-height-input");
    const applyCustomSizeBtn = document.getElementById("apply-custom-size");
    const toolSizeRange = document.getElementById("tool-size-range");
    const toolSizeValue = document.getElementById("tool-size-value");
    const templateSelect = document.getElementById("template-select");
    const clearTemplateButton = document.getElementById("clear-template-btn");
    const templateOpacityRange = document.getElementById("template-opacity-range");
    const templateOpacityValue = document.getElementById("template-opacity-value");
    const layersList = document.getElementById("layers-list");
    const addLayerBtn = document.getElementById("add-layer-btn");
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
    const currentLayerLabel = document.getElementById("meta-layer");

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

    if (!previewCanvas || !previewCtx || !paletteEl || !form || !templateCtx) return;

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
    const MAX_LAYERS = 16;
    const MIN_CANVAS_ZOOM = 0.5;
    const MAX_CANVAS_ZOOM = 8;
    const CANVAS_ZOOM_STEP = 0.12;
    const TEMPLATE_SIZE_32 = 32;
    const TEMPLATE_SIZE_64 = 64;
    const MIN_TEMPLATE_OPACITY = 15;
    const MAX_TEMPLATE_OPACITY = 80;
    const DEFAULT_TEMPLATE_OPACITY = 45;

    function createScaledTemplateDraw(baseDraw, baseSize, targetSize) {
        return function drawScaledTemplate(targetCtx) {
            if (baseSize === targetSize) {
                baseDraw(targetCtx);
                return;
            }
            const tempCanvas = document.createElement("canvas");
            tempCanvas.width = baseSize;
            tempCanvas.height = baseSize;
            const tempCtx = tempCanvas.getContext("2d");
            if (!tempCtx) return;
            tempCtx.imageSmoothingEnabled = false;
            tempCtx.fillStyle = targetCtx.fillStyle;
            baseDraw(tempCtx);
            targetCtx.imageSmoothingEnabled = false;
            targetCtx.drawImage(tempCanvas, 0, 0, targetSize, targetSize);
        };
    }

    const TEMPLATE_LIBRARY = [
        { id: "forest-32", name: "Лес", width: TEMPLATE_SIZE_32, height: TEMPLATE_SIZE_32, draw: drawForestTemplate32 },
        { id: "house-32", name: "Домик и деревья", width: TEMPLATE_SIZE_32, height: TEMPLATE_SIZE_32, draw: drawHouseTemplate32 },
        { id: "mountains-32", name: "Горы и река", width: TEMPLATE_SIZE_32, height: TEMPLATE_SIZE_32, draw: drawMountainsTemplate32 },
        {
            id: "forest-64",
            name: "Лес",
            width: TEMPLATE_SIZE_64,
            height: TEMPLATE_SIZE_64,
            draw: createScaledTemplateDraw(drawForestTemplate32, TEMPLATE_SIZE_32, TEMPLATE_SIZE_64),
        },
        {
            id: "house-64",
            name: "Домик и деревья",
            width: TEMPLATE_SIZE_64,
            height: TEMPLATE_SIZE_64,
            draw: createScaledTemplateDraw(drawHouseTemplate32, TEMPLATE_SIZE_32, TEMPLATE_SIZE_64),
        },
        {
            id: "mountains-64",
            name: "Горы и река",
            width: TEMPLATE_SIZE_64,
            height: TEMPLATE_SIZE_64,
            draw: createScaledTemplateDraw(drawMountainsTemplate32, TEMPLATE_SIZE_32, TEMPLATE_SIZE_64),
        },
    ];

    let selectedColor = PALETTE[4];
    let selectedTool = "pencil";
    let brushSize = 1;
    let gridWidth = 32;
    let gridHeight = 32;
    let layers = [];
    let activeLayerId = null;
    let layerIdCounter = 1;
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
    let handDragState = null;
    let selectedTemplateId = "";
    let templateOpacity = DEFAULT_TEMPLATE_OPACITY;
    let canvasZoom = 1;

    function getAvailableCanvasBounds() {
        const viewport = canvasViewport;
        if (!viewport) {
            return { width: 480, height: 480 };
        }

        const rect = viewport.getBoundingClientRect();
        const statusBar = viewport.querySelector(".canvas-meta");
        const statusHeight = statusBar ? statusBar.getBoundingClientRect().height : 0;
        const padding = 32;

        return {
            width: Math.max(160, rect.width - padding),
            height: Math.max(160, rect.height - statusHeight - padding),
        };
    }

    function applyCanvasZoom() {
        if (!canvasContainer) return;
        const bounds = getAvailableCanvasBounds();
        const aspect = gridWidth / gridHeight;
        let baseWidth;
        let baseHeight;

        if (bounds.width / bounds.height > aspect) {
            baseHeight = bounds.height;
            baseWidth = baseHeight * aspect;
        } else {
            baseWidth = bounds.width;
            baseHeight = baseWidth / aspect;
        }

        const width = Math.max(160, Math.round(baseWidth * canvasZoom));
        const height = Math.max(160, Math.round(baseHeight * canvasZoom));
        canvasContainer.style.setProperty("--canvas-display-width", `${width}px`);
        canvasContainer.style.setProperty("--canvas-display-height", `${height}px`);
        canvasContainer.style.width = `${width}px`;
        canvasContainer.style.height = `${height}px`;
        syncCanvasDisplaySize();
        if (zoomLabel) zoomLabel.textContent = `${Math.round(canvasZoom * 100)}%`;
    }

    function scheduleCanvasLayout() {
        applyCanvasZoom();
        requestAnimationFrame(() => {
            applyCanvasZoom();
            requestAnimationFrame(applyCanvasZoom);
        });
    }

    function setCanvasZoom(nextZoom) {
        canvasZoom = Math.min(MAX_CANVAS_ZOOM, Math.max(MIN_CANVAS_ZOOM, nextZoom));
        applyCanvasZoom();
    }

    function activateSidebarPanel(panelId) {
        sidebarTabs.forEach((tab) => {
            tab.classList.toggle("is-active", tab.dataset.tab === panelId);
        });
        sidebarPanels.forEach((panel) => {
            panel.classList.toggle("is-active", panel.dataset.panel === panelId);
        });
    }

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

    function clampTemplateOpacity(value, fallback = DEFAULT_TEMPLATE_OPACITY) {
        const parsed = Number.parseInt(String(value ?? ""), 10);
        if (!Number.isFinite(parsed)) return fallback;
        return Math.max(MIN_TEMPLATE_OPACITY, Math.min(MAX_TEMPLATE_OPACITY, parsed));
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
        if (tool === "hand") {
            canvas.style.cursor = isDrawing ? "grabbing" : "grab";
            return;
        }
        if (tool === "eyedropper") {
            canvas.style.cursor = "cell";
            return;
        }
        canvas.style.cursor = "crosshair";
    }

    function getTemplateById(templateId) {
        return TEMPLATE_LIBRARY.find((template) => template.id === templateId) || null;
    }

    function drawTemplatePixel(targetCtx, x, y) {
        if (x < 0 || y < 0 || x >= targetCtx.canvas.width || y >= targetCtx.canvas.height) return;
        targetCtx.fillRect(x, y, 1, 1);
    }

    function drawTemplateLine(targetCtx, startX, startY, endX, endY) {
        let x0 = startX;
        let y0 = startY;
        const dx = Math.abs(endX - x0);
        const dy = Math.abs(endY - y0);
        const sx = x0 < endX ? 1 : -1;
        const sy = y0 < endY ? 1 : -1;
        let err = dx - dy;

        while (true) {
            drawTemplatePixel(targetCtx, x0, y0);
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

    function drawTemplatePolyline(targetCtx, points, close = false) {
        if (!Array.isArray(points) || points.length < 2) return;
        for (let i = 1; i < points.length; i += 1) {
            drawTemplateLine(targetCtx, points[i - 1].x, points[i - 1].y, points[i].x, points[i].y);
        }
        if (close) {
            drawTemplateLine(
                targetCtx,
                points[points.length - 1].x,
                points[points.length - 1].y,
                points[0].x,
                points[0].y
            );
        }
    }

    function drawTemplateRect(targetCtx, startX, startY, width, height) {
        if (width <= 0 || height <= 0) return;
        const endX = startX + width - 1;
        const endY = startY + height - 1;
        drawTemplateLine(targetCtx, startX, startY, endX, startY);
        drawTemplateLine(targetCtx, endX, startY, endX, endY);
        drawTemplateLine(targetCtx, endX, endY, startX, endY);
        drawTemplateLine(targetCtx, startX, endY, startX, startY);
    }

    function drawTemplateCircle(targetCtx, centerX, centerY, radius) {
        if (radius <= 0) return;
        let x = radius;
        let y = 0;
        let error = 1 - x;

        while (x >= y) {
            drawTemplatePixel(targetCtx, centerX + x, centerY + y);
            drawTemplatePixel(targetCtx, centerX + y, centerY + x);
            drawTemplatePixel(targetCtx, centerX - y, centerY + x);
            drawTemplatePixel(targetCtx, centerX - x, centerY + y);
            drawTemplatePixel(targetCtx, centerX - x, centerY - y);
            drawTemplatePixel(targetCtx, centerX - y, centerY - x);
            drawTemplatePixel(targetCtx, centerX + y, centerY - x);
            drawTemplatePixel(targetCtx, centerX + x, centerY - y);
            y += 1;
            if (error < 0) {
                error += 2 * y + 1;
            } else {
                x -= 1;
                error += 2 * (y - x) + 1;
            }
        }
    }

    function drawPineGuide(targetCtx, centerX, topY, crownWidths, trunkHeight = 5) {
        let levelTop = topY;
        crownWidths.forEach((crownWidth) => {
            const half = Math.floor(crownWidth / 2);
            const baseY = levelTop + 4;
            drawTemplatePolyline(targetCtx, [
                { x: centerX, y: levelTop },
                { x: centerX - half, y: baseY },
                { x: centerX + half, y: baseY },
            ], true);
            levelTop += 4;
        });
        drawTemplateRect(targetCtx, centerX - 1, levelTop, 3, trunkHeight);
    }

    function drawForestTemplate32(targetCtx) {
        drawTemplateLine(targetCtx, 0, 30, 31, 30);
        drawTemplateLine(targetCtx, 0, 31, 31, 31);
        drawPineGuide(targetCtx, 16, 4, [11, 14, 18], 6);
        drawPineGuide(targetCtx, 7, 10, [7, 9], 4);
        drawPineGuide(targetCtx, 25, 9, [7, 9], 5);
        drawTemplateCircle(targetCtx, 26, 5, 2);
        drawTemplatePolyline(targetCtx, [{ x: 10, y: 6 }, { x: 11, y: 5 }, { x: 12, y: 6 }]);
        drawTemplatePolyline(targetCtx, [{ x: 14, y: 5 }, { x: 15, y: 4 }, { x: 16, y: 5 }]);
    }

    function drawHouseTemplate32(targetCtx) {
        drawTemplateLine(targetCtx, 0, 30, 31, 30);
        drawTemplateLine(targetCtx, 0, 31, 31, 31);
        drawTemplateRect(targetCtx, 9, 13, 14, 12);
        drawTemplatePolyline(targetCtx, [
            { x: 16, y: 7 },
            { x: 8, y: 13 },
            { x: 24, y: 13 },
        ], true);
        drawTemplateRect(targetCtx, 14, 19, 4, 6);
        drawTemplateRect(targetCtx, 11, 16, 3, 3);
        drawTemplateRect(targetCtx, 19, 16, 3, 3);
        drawPineGuide(targetCtx, 4, 12, [6, 8], 4);
        drawPineGuide(targetCtx, 28, 12, [6, 8], 4);
    }

    function drawMountainsTemplate32(targetCtx) {
        drawTemplateLine(targetCtx, 0, 30, 31, 30);
        drawTemplateLine(targetCtx, 0, 31, 31, 31);
        drawTemplatePolyline(targetCtx, [
            { x: 2, y: 22 },
            { x: 9, y: 11 },
            { x: 16, y: 22 },
        ], true);
        drawTemplatePolyline(targetCtx, [
            { x: 11, y: 22 },
            { x: 19, y: 9 },
            { x: 29, y: 22 },
        ], true);
        drawTemplatePolyline(targetCtx, [
            { x: 3, y: 25 },
            { x: 9, y: 27 },
            { x: 14, y: 27 },
            { x: 20, y: 29 },
            { x: 25, y: 30 },
            { x: 31, y: 31 },
        ]);
        drawTemplatePolyline(targetCtx, [
            { x: 4, y: 27 },
            { x: 9, y: 29 },
            { x: 14, y: 29 },
            { x: 21, y: 31 },
            { x: 26, y: 31 },
            { x: 31, y: 31 },
        ]);
        drawTemplateCircle(targetCtx, 6, 6, 2);
    }

    function updateTemplateOverlayVisibility() {
        const hasTemplate = Boolean(selectedTemplateId);
        templateCanvas.style.display = hasTemplate ? "block" : "none";
        if (clearTemplateButton) clearTemplateButton.disabled = !hasTemplate;
    }

    function renderTemplateOverlay() {
        templateCtx.clearRect(0, 0, gridWidth, gridHeight);
        const activeTemplate = getTemplateById(selectedTemplateId);
        if (!activeTemplate) return;

        const templateSourceCanvas = document.createElement("canvas");
        templateSourceCanvas.width = activeTemplate.width;
        templateSourceCanvas.height = activeTemplate.height;
        const templateSourceCtx = templateSourceCanvas.getContext("2d");
        if (!templateSourceCtx) return;

        templateSourceCtx.imageSmoothingEnabled = false;
        templateSourceCtx.fillStyle = "#1B4332";
        activeTemplate.draw(templateSourceCtx);

        templateCtx.imageSmoothingEnabled = false;
        templateCtx.drawImage(templateSourceCanvas, 0, 0, gridWidth, gridHeight);

        // Hide template under already painted pixels to avoid darkening colors.
        templateCtx.save();
        templateCtx.globalCompositeOperation = "destination-out";
        layers.forEach((layer) => {
            if (!layer.visible) return;
            templateCtx.drawImage(layer.canvas, 0, 0);
        });
        templateCtx.restore();
    }

    function syncTemplateOpacity(value) {
        templateOpacity = clampTemplateOpacity(value, templateOpacity);
        if (templateOpacityRange) templateOpacityRange.value = String(templateOpacity);
        if (templateOpacityValue) templateOpacityValue.textContent = `${templateOpacity}%`;
        templateCanvas.style.opacity = String(templateOpacity / 100);
    }

    function confirmResizeForTemplate(template) {
        if (!template) return true;
        if (gridWidth === template.width && gridHeight === template.height) return true;
        const warning = isDrawingChanged ? "\nТекущий рисунок будет очищен." : "";
        const confirmed = window.confirm(
            `Шаблон "${template.name}" рассчитан на ${template.width}×${template.height}. Переключить размер холста?${warning}`
        );
        if (!confirmed) return false;
        initCanvas(template.width, template.height);
        setPresetSelection(template.width, template.height);
        return true;
    }

    function createLayer(width, height, options = {}) {
        const layerCanvas = document.createElement("canvas");
        layerCanvas.width = width;
        layerCanvas.height = height;
        const layerCtx = layerCanvas.getContext("2d", { willReadFrequently: true });
        if (!layerCtx) return null;
        layerCtx.imageSmoothingEnabled = false;
        if (options.imageData) {
            layerCtx.putImageData(options.imageData, 0, 0);
        }
        const id = options.id || `layer-${layerIdCounter++}`;
        return {
            id,
            name: options.name || `Слой ${layers.length + 1}`,
            visible: options.visible !== false,
            canvas: layerCanvas,
            ctx: layerCtx,
        };
    }

    function getActiveLayer() {
        return layers.find((layer) => layer.id === activeLayerId) || layers[layers.length - 1] || null;
    }

    function getActiveLayerCtx() {
        return getActiveLayer()?.ctx || null;
    }

    function getActiveLayerName() {
        return getActiveLayer()?.name || "Слой";
    }

    function renderComposite() {
        ctx.clearRect(0, 0, gridWidth, gridHeight);
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, gridWidth, gridHeight);
        layers.forEach((layer) => {
            if (!layer.visible) return;
            ctx.drawImage(layer.canvas, 0, 0);
        });
        renderTemplateOverlay();
        renderPreview();
    }

    function setActiveLayer(layerId) {
        if (!layers.some((layer) => layer.id === layerId)) return;
        activeLayerId = layerId;
        renderLayersPanel();
        updateStatusBar();
        if (lastHoverPoint) drawCursorHighlight(lastHoverPoint.x, lastHoverPoint.y);
    }

    function toggleLayerVisibility(layerId) {
        const layer = layers.find((item) => item.id === layerId);
        if (!layer) return;
        layer.visible = !layer.visible;
        if (!layer.visible && layer.id === activeLayerId) {
            const visibleFallback = layers.find((item) => item.visible);
            if (visibleFallback) {
                activeLayerId = visibleFallback.id;
            }
        }
        renderLayersPanel();
        renderComposite();
        updateStatusBar();
        saveState();
        markChanged();
    }

    function removeLayer(layerId) {
        if (layers.length <= 1) {
            submitResultEl.textContent = "Нельзя удалить последний слой.";
            return;
        }
        const index = layers.findIndex((layer) => layer.id === layerId);
        if (index < 0) return;
        layers.splice(index, 1);
        if (activeLayerId === layerId) {
            const fallback = layers[Math.max(0, index - 1)] || layers[layers.length - 1];
            activeLayerId = fallback.id;
        }
        renderLayersPanel();
        renderComposite();
        updateStatusBar();
        saveState();
        markChanged();
    }

    function renderLayersPanel() {
        if (!layersList) return;
        layersList.innerHTML = "";
        const orderedLayers = [...layers].reverse();
        orderedLayers.forEach((layer) => {
            const item = document.createElement("div");
            item.className = `layer-item${layer.id === activeLayerId ? " active" : ""}`;

            const selectButton = document.createElement("button");
            selectButton.type = "button";
            selectButton.className = "layer-select-btn";
            selectButton.innerHTML = `<span class="layer-name">${layer.name}</span><span class="layer-subtitle">${layer.visible ? "Виден" : "Скрыт"}</span>`;
            selectButton.addEventListener("click", () => setActiveLayer(layer.id));
            item.appendChild(selectButton);

            const visibilityButton = document.createElement("button");
            visibilityButton.type = "button";
            visibilityButton.className = `layer-action-btn layer-visibility-btn${layer.visible ? "" : " off"}`;
            visibilityButton.textContent = layer.visible ? "ON" : "OFF";
            visibilityButton.title = layer.visible ? "Скрыть слой" : "Показать слой";
            visibilityButton.addEventListener("click", () => toggleLayerVisibility(layer.id));
            item.appendChild(visibilityButton);

            const removeButton = document.createElement("button");
            removeButton.type = "button";
            removeButton.className = "layer-action-btn layer-remove-btn";
            removeButton.textContent = "X";
            removeButton.title = "Удалить слой";
            removeButton.disabled = layers.length <= 1;
            removeButton.addEventListener("click", () => removeLayer(layer.id));
            item.appendChild(removeButton);

            layersList.appendChild(item);
        });
    }

    function addLayer() {
        if (layers.length >= MAX_LAYERS) {
            submitResultEl.textContent = `Максимум слоёв: ${MAX_LAYERS}.`;
            return;
        }
        const layer = createLayer(gridWidth, gridHeight, {
            name: `Слой ${layers.length + 1}`,
        });
        if (!layer) return;
        layers.push(layer);
        activeLayerId = layer.id;
        renderLayersPanel();
        renderComposite();
        updateStatusBar();
        saveState();
        markChanged();
    }

    function snapshotLayersState() {
        return {
            activeLayerId,
            layers: layers.map((layer) => ({
                id: layer.id,
                name: layer.name,
                visible: layer.visible,
                imageData: layer.ctx.getImageData(0, 0, gridWidth, gridHeight),
            })),
        };
    }

    function applyLayersSnapshot(snapshot) {
        if (!snapshot || !Array.isArray(snapshot.layers) || !snapshot.layers.length) return;
        const rebuiltLayers = snapshot.layers
            .map((layer) => createLayer(gridWidth, gridHeight, layer))
            .filter(Boolean);
        if (!rebuiltLayers.length) return;
        layers = rebuiltLayers;
        const hasActiveLayer = layers.some((layer) => layer.id === snapshot.activeLayerId);
        activeLayerId = hasActiveLayer ? snapshot.activeLayerId : layers[layers.length - 1].id;
        const maxLayerId = layers.reduce((max, layer) => {
            const match = /^layer-(\d+)$/.exec(layer.id);
            if (!match) return max;
            return Math.max(max, Number.parseInt(match[1], 10));
        }, 0);
        layerIdCounter = Math.max(maxLayerId + 1, layers.length + 1);
        renderLayersPanel();
        renderComposite();
        handDragState = null;
        isDrawing = false;
        setCanvasCursorByTool(selectedTool);
        updateStatusBar();
    }

    function alphaAt(data, width, x, y) {
        return data[(y * width + x) * 4 + 3];
    }

    function captureConnectedRegion(imageData, startX, startY) {
        const width = imageData.width;
        const height = imageData.height;
        const data = imageData.data;
        if (startX < 0 || startY < 0 || startX >= width || startY >= height) return null;
        if (alphaAt(data, width, startX, startY) === 0) return null;

        const visited = new Uint8Array(width * height);
        const mask = new Uint8Array(width * height);
        const pixels = [];
        const stack = [{ x: startX, y: startY }];
        let minX = startX;
        let maxX = startX;
        let minY = startY;
        let maxY = startY;

        while (stack.length) {
            const point = stack.pop();
            const idx = point.y * width + point.x;
            if (visited[idx]) continue;
            visited[idx] = 1;
            if (alphaAt(data, width, point.x, point.y) === 0) continue;

            mask[idx] = 1;
            const offset = idx * 4;
            pixels.push({
                x: point.x,
                y: point.y,
                r: data[offset],
                g: data[offset + 1],
                b: data[offset + 2],
                a: data[offset + 3],
            });
            minX = Math.min(minX, point.x);
            maxX = Math.max(maxX, point.x);
            minY = Math.min(minY, point.y);
            maxY = Math.max(maxY, point.y);

            if (point.x > 0) stack.push({ x: point.x - 1, y: point.y });
            if (point.x < width - 1) stack.push({ x: point.x + 1, y: point.y });
            if (point.y > 0) stack.push({ x: point.x, y: point.y - 1 });
            if (point.y < height - 1) stack.push({ x: point.x, y: point.y + 1 });
        }

        if (!pixels.length) return null;
        return {
            mask,
            pixels,
            minX,
            maxX,
            minY,
            maxY,
        };
    }

    function buildMovedRegionPreview(state, dx, dy) {
        const source = state.baseImageData.data;
        const previewData = new Uint8ClampedArray(source);
        for (let i = 0; i < state.mask.length; i += 1) {
            if (!state.mask[i]) continue;
            const offset = i * 4;
            previewData[offset] = 0;
            previewData[offset + 1] = 0;
            previewData[offset + 2] = 0;
            previewData[offset + 3] = 0;
        }
        state.pixels.forEach((pixel) => {
            const targetX = pixel.x + dx;
            const targetY = pixel.y + dy;
            if (targetX < 0 || targetY < 0 || targetX >= gridWidth || targetY >= gridHeight) return;
            const targetOffset = (targetY * gridWidth + targetX) * 4;
            previewData[targetOffset] = pixel.r;
            previewData[targetOffset + 1] = pixel.g;
            previewData[targetOffset + 2] = pixel.b;
            previewData[targetOffset + 3] = pixel.a;
        });
        return new ImageData(previewData, gridWidth, gridHeight);
    }

    function clampHandDelta(state, rawDx, rawDy) {
        const minDx = -state.minX;
        const maxDx = (gridWidth - 1) - state.maxX;
        const minDy = -state.minY;
        const maxDy = (gridHeight - 1) - state.maxY;
        return {
            dx: Math.max(minDx, Math.min(maxDx, rawDx)),
            dy: Math.max(minDy, Math.min(maxDy, rawDy)),
        };
    }

    function renderHandDragPreview() {
        if (!handDragState) return;
        const layerCtx = getActiveLayerCtx();
        if (!layerCtx) return;
        const preview = buildMovedRegionPreview(handDragState, handDragState.dx, handDragState.dy);
        layerCtx.putImageData(preview, 0, 0);
        renderComposite();
    }

    function beginHandDrag(startPoint) {
        const layerCtx = getActiveLayerCtx();
        if (!layerCtx) return false;
        submitResultEl.textContent = "";
        const baseImageData = layerCtx.getImageData(0, 0, gridWidth, gridHeight);
        const region = captureConnectedRegion(baseImageData, startPoint.x, startPoint.y);
        if (!region) {
            submitResultEl.textContent = "Выбери нарисованный объект для перемещения.";
            return false;
        }
        saveState();
        handDragState = {
            ...region,
            baseImageData,
            startPoint,
            dx: 0,
            dy: 0,
        };
        canvas.style.cursor = "grabbing";
        return true;
    }

    function updateHandDrag(point) {
        if (!handDragState) return;
        const rawDx = point.x - handDragState.startPoint.x;
        const rawDy = point.y - handDragState.startPoint.y;
        const clamped = clampHandDelta(handDragState, rawDx, rawDy);
        handDragState.dx = clamped.dx;
        handDragState.dy = clamped.dy;
        renderHandDragPreview();
    }

    function finalizeHandDrag() {
        if (!handDragState) return;
        const moved = handDragState.dx !== 0 || handDragState.dy !== 0;
        const layerCtx = getActiveLayerCtx();
        if (layerCtx && !moved) {
            layerCtx.putImageData(handDragState.baseImageData, 0, 0);
            renderComposite();
        } else if (moved) {
            saveState();
            markChanged();
        }
        handDragState = null;
        canvas.style.cursor = "grab";
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

    function paintBrushAt(x, y, color, size = brushSize, targetCtx = getActiveLayerCtx(), erase = false) {
        if (!targetCtx) return;
        if (!erase) {
            targetCtx.fillStyle = color;
        }
        forEachBrushPixel(x, y, size, (px, py) => {
            if (erase) {
                targetCtx.clearRect(px, py, 1, 1);
            } else {
                targetCtx.fillRect(px, py, 1, 1);
            }
        });
    }

    function drawLineSegment(startX, startY, endX, endY, color, size = brushSize, targetCtx = getActiveLayerCtx(), erase = false) {
        let x0 = startX;
        let y0 = startY;
        const dx = Math.abs(endX - x0);
        const dy = Math.abs(endY - y0);
        const sx = x0 < endX ? 1 : -1;
        const sy = y0 < endY ? 1 : -1;
        let err = dx - dy;

        while (true) {
            paintBrushAt(x0, y0, color, size, targetCtx, erase);
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

    function drawRectangleOutline(start, end, color, size = brushSize, targetCtx = getActiveLayerCtx(), erase = false) {
        const minX = Math.min(start.x, end.x);
        const maxX = Math.max(start.x, end.x);
        const minY = Math.min(start.y, end.y);
        const maxY = Math.max(start.y, end.y);
        drawLineSegment(minX, minY, maxX, minY, color, size, targetCtx, erase);
        drawLineSegment(maxX, minY, maxX, maxY, color, size, targetCtx, erase);
        drawLineSegment(maxX, maxY, minX, maxY, color, size, targetCtx, erase);
        drawLineSegment(minX, maxY, minX, minY, color, size, targetCtx, erase);
    }

    function drawCircleFromPoints(start, end, color, size = brushSize, targetCtx = getActiveLayerCtx(), erase = false) {
        const radius = Math.round(Math.hypot(end.x - start.x, end.y - start.y));
        if (radius <= 0) {
            paintBrushAt(start.x, start.y, color, size, targetCtx, erase);
            return;
        }
        const step = 1 / Math.max(radius * 10, 48);
        for (let angle = 0; angle <= Math.PI * 2; angle += step) {
            const x = Math.round(start.x + radius * Math.cos(angle));
            const y = Math.round(start.y + radius * Math.sin(angle));
            paintBrushAt(x, y, color, size, targetCtx, erase);
        }
    }

    function drawShapeByTool(tool, start, end, color, size = brushSize, targetCtx = getActiveLayerCtx(), erase = false) {
        if (tool === "line") {
            drawLineSegment(start.x, start.y, end.x, end.y, color, size, targetCtx, erase);
            return;
        }
        if (tool === "rectangle") {
            drawRectangleOutline(start, end, color, size, targetCtx, erase);
            return;
        }
        if (tool === "circle") {
            drawCircleFromPoints(start, end, color, size, targetCtx, erase);
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
        if (selectedTool === "eraser") {
            return "#1B4332";
        }
        return selectedColor;
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

    function applyTemplateSelection(nextTemplateId, options = {}) {
        const shouldPromptResize = options.shouldPromptResize !== false;
        const normalizedId = getTemplateById(nextTemplateId)?.id || "";
        const previousTemplateId = selectedTemplateId;
        selectedTemplateId = normalizedId;

        const template = getTemplateById(selectedTemplateId);
        if (template && shouldPromptResize && !confirmResizeForTemplate(template)) {
            selectedTemplateId = previousTemplateId;
            if (templateSelect) templateSelect.value = previousTemplateId;
            updateTemplateOverlayVisibility();
            renderTemplateOverlay();
            return false;
        }

        if (templateSelect) templateSelect.value = selectedTemplateId;
        updateTemplateOverlayVisibility();
        renderTemplateOverlay();
        return true;
    }

    function syncCanvasDisplaySize() {
        if (!canvasContainer) return;
        const rect = canvasContainer.getBoundingClientRect();
        const displayWidth = Math.floor(rect.width);
        const displayHeight = Math.floor(rect.height);
        if (!displayWidth || !displayHeight) return;
        canvas.style.width = `${displayWidth}px`;
        canvas.style.height = `${displayHeight}px`;
        templateCanvas.style.width = `${displayWidth}px`;
        templateCanvas.style.height = `${displayHeight}px`;
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
        templateCanvas.width = gridWidth;
        templateCanvas.height = gridHeight;
        gridCanvas.width = gridWidth;
        gridCanvas.height = gridHeight;
        cursorCanvas.width = gridWidth;
        cursorCanvas.height = gridHeight;
        if (canvasContainer) {
            canvasContainer.style.removeProperty("aspect-ratio");
        }
        ctx.imageSmoothingEnabled = false;
        templateCtx.imageSmoothingEnabled = false;
        gridCtx.imageSmoothingEnabled = false;
        cursorCtx.imageSmoothingEnabled = false;

        layers = [];
        activeLayerId = null;
        layerIdCounter = 1;
        const baseLayer = createLayer(gridWidth, gridHeight, { name: "Слой 1" });
        if (baseLayer) {
            layers.push(baseLayer);
            activeLayerId = baseLayer.id;
        }

        drawGrid();
        clearCursorHighlight();
        applyCanvasZoom();
        renderTemplateOverlay();
        updateTemplateOverlayVisibility();
        syncCustomInputs(gridWidth, gridHeight);
        renderLayersPanel();
        history = [];
        redoHistory = [];
        saveState(false);
        renderComposite();
        setCanvasCursorByTool(selectedTool);
        updateStatusBar();
        isDrawingChanged = false;
    }

    function saveState(clearRedo = true) {
        if (!layers.length) return;
        history.push(snapshotLayersState());
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
        applyLayersSnapshot(history[history.length - 1]);
        isDrawingChanged = history.length > 1;
    }

    function redoState() {
        if (!redoHistory.length) return;
        const next = redoHistory.pop();
        if (!next) return;
        history.push(next);
        if (history.length > HISTORY_LIMIT) history.shift();
        applyLayersSnapshot(next);
        isDrawingChanged = history.length > 1;
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
        if (selectedTool === "hand") {
            clearCursorHighlight();
            return;
        }
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
        const layerCtx = getActiveLayerCtx();
        if (!layerCtx) return;
        layerCtx.fillStyle = color;
        layerCtx.fillRect(x, y, 1, 1);
    }

    function hexToRgba(hex) {
        const value = hex.replace("#", "");
        const n = Number.parseInt(value, 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
    }

    function floodFill(startX, startY, fillColorHex) {
        const layerCtx = getActiveLayerCtx();
        if (!layerCtx) return;
        const imageData = layerCtx.getImageData(0, 0, canvas.width, canvas.height);
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

        layerCtx.putImageData(imageData, 0, 0);
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
        if (currentLayerLabel) currentLayerLabel.textContent = getActiveLayerName();
        if (toolSizeValue) toolSizeValue.textContent = `${brushSize} px`;
    }

    function pickColorAtPoint(point) {
        const pixel = ctx.getImageData(point.x, point.y, 1, 1).data;
        activateColor(rgbaToHex(pixel[0], pixel[1], pixel[2]));
    }

    function beginShapePreview(startPoint) {
        const layerCtx = getActiveLayerCtx();
        if (!layerCtx) return;
        shapePreviewImageData = layerCtx.getImageData(0, 0, canvas.width, canvas.height);
        dragStartPoint = startPoint;
        lastDrawPoint = startPoint;
    }

    function renderShapePreview(endPoint) {
        const layerCtx = getActiveLayerCtx();
        if (!shapePreviewImageData || !dragStartPoint || !layerCtx) return;
        layerCtx.putImageData(shapePreviewImageData, 0, 0);
        drawShapeByTool(selectedTool, dragStartPoint, endPoint, selectedColor, brushSize, layerCtx, false);
        lastDrawPoint = endPoint;
        renderComposite();
        markChanged();
    }

    function applyFreehandAtPoint(point) {
        const layerCtx = getActiveLayerCtx();
        if (!layerCtx) return;
        const erase = selectedTool === "eraser";
        if (!lastDrawPoint) {
            drawLineSegment(point.x, point.y, point.x, point.y, selectedColor, brushSize, layerCtx, erase);
            lastDrawPoint = point;
            return;
        }
        drawLineSegment(lastDrawPoint.x, lastDrawPoint.y, point.x, point.y, selectedColor, brushSize, layerCtx, erase);
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

        if (selectedTool === "hand") {
            isDrawing = beginHandDrag(point);
            return;
        }

        if (selectedTool === "fill") {
            saveState();
            floodFill(point.x, point.y, selectedColor);
            saveState();
            renderComposite();
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
        renderComposite();
        markChanged();
    }

    function moveDraw(event) {
        if (!isDrawing || selectedTool === "fill" || selectedTool === "eyedropper") return;
        if (event.cancelable) event.preventDefault();
        const point = getCanvasPoint(event);

        if (selectedTool === "hand") {
            updateHandDrag(point);
            return;
        }

        if (isShapeTool(selectedTool)) {
            renderShapePreview(point);
            return;
        }

        applyFreehandAtPoint(point);
        renderComposite();
        markChanged();
    }

    function finalizeShapeDraw(event) {
        const endPoint = event ? getCanvasPoint(event) : (lastDrawPoint || dragStartPoint);
        const layerCtx = getActiveLayerCtx();
        if (!shapePreviewImageData || !dragStartPoint || !endPoint || !layerCtx) return;
        layerCtx.putImageData(shapePreviewImageData, 0, 0);
        drawShapeByTool(selectedTool, dragStartPoint, endPoint, selectedColor, brushSize, layerCtx, false);
        renderComposite();
        markChanged();
    }

    function resetDragState() {
        dragStartPoint = null;
        lastDrawPoint = null;
        shapePreviewImageData = null;
        handDragState = null;
    }

    function stopDraw(event) {
        if (!isDrawing) return;
        if (selectedTool === "hand") {
            finalizeHandDrag();
            isDrawing = false;
            resetDragState();
            return;
        }
        if (isShapeTool(selectedTool)) finalizeShapeDraw(event);
        saveState();
        isDrawing = false;
        resetDragState();
    }

    function clearCanvas() {
        layers.forEach((layer) => {
            layer.ctx.clearRect(0, 0, canvas.width, canvas.height);
        });
        saveState();
        renderComposite();
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
            const layerCtx = getActiveLayerCtx();
            if (!layerCtx) return;
            layers.forEach((layer) => {
                layer.ctx.clearRect(0, 0, canvas.width, canvas.height);
            });
            layerCtx.drawImage(image, 0, 0, canvas.width, canvas.height);
            saveState();
            renderComposite();
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
        if (key === "h") setTool("hand");
    }

    toolButtons.forEach((button) => {
        button.addEventListener("click", () => setTool(button.dataset.tool));
    });

    undoButton?.addEventListener("click", restoreState);
    redoButton?.addEventListener("click", redoState);
    clearButton?.addEventListener("click", clearCanvas);
    addLayerBtn?.addEventListener("click", addLayer);
    addCustomColorBtn?.addEventListener("click", () => customColorPicker?.click());
    toolSizeRange?.addEventListener("input", (event) => {
        syncBrushSize(event.target.value);
        if (lastHoverPoint) drawCursorHighlight(lastHoverPoint.x, lastHoverPoint.y);
    });
    templateSelect?.addEventListener("change", (event) => {
        applyTemplateSelection(event.target.value);
    });
    clearTemplateButton?.addEventListener("click", () => {
        applyTemplateSelection("", { shouldPromptResize: false });
    });
    templateOpacityRange?.addEventListener("input", (event) => {
        syncTemplateOpacity(event.target.value);
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
        if (selectedTool === "hand") {
            clearCursorHighlight();
            return;
        }
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

    sidebarTabs.forEach((tab) => {
        tab.addEventListener("click", () => activateSidebarPanel(tab.dataset.tab));
    });

    canvasViewport?.addEventListener(
        "wheel",
        (event) => {
            event.preventDefault();
            const delta = event.deltaY > 0 ? -CANVAS_ZOOM_STEP : CANVAS_ZOOM_STEP;
            setCanvasZoom(canvasZoom + delta);
        },
        { passive: false }
    );

    window.addEventListener("keydown", handleKeyboard);
    window.addEventListener("resize", scheduleCanvasLayout);

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
    syncTemplateOpacity(templateOpacity);
    initCanvas(32, 32);
    scheduleCanvasLayout();
    if (typeof ResizeObserver !== "undefined") {
        const layoutObserver = new ResizeObserver(() => scheduleCanvasLayout());
        if (canvasViewport) layoutObserver.observe(canvasViewport);
        if (canvasStage) layoutObserver.observe(canvasStage);
    }
    setPresetSelection(32, 32);
    updateCategoryPreview();
    restoreDraftIfExists();
    setTool("pencil");
})();
