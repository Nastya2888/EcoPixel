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
    const undoButton = document.getElementById("undo-button");
    const clearButton = document.getElementById("clear-button");
    const submitButton = document.getElementById("submit-btn");
    const drawPage = document.querySelector(".draw-page");
    const authRequiredMessage = document.getElementById("auth-required-message");
    const toolButtons = document.querySelectorAll(".tool-btn[data-tool]");
    const currentSizeLabel = document.getElementById("canvas-size-badge");
    const currentColorLabel = document.getElementById("meta-color");
    const currentColorDot = document.getElementById("current-color-dot");

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

    let selectedColor = PALETTE[4];
    let selectedTool = "pencil";
    let gridSize = 32;
    let isDrawing = false;
    let isDrawingChanged = false;
    let history = [];
    let activeSwatch = null;
    let customColors = [];
    let progressTimer = null;
    let lastSubmittedUrl = "";

    function normalizeHex(hex) {
        return String(hex || "").trim().toUpperCase();
    }

    function syncCanvasDisplaySize() {
        if (!canvasContainer) return;
        const displaySize = Math.floor(canvasContainer.getBoundingClientRect().width);
        if (!displaySize) return;
        canvas.style.width = `${displaySize}px`;
        canvas.style.height = `${displaySize}px`;
        gridCanvas.style.width = `${displaySize}px`;
        gridCanvas.style.height = `${displaySize}px`;
        cursorCanvas.style.width = `${displaySize}px`;
        cursorCanvas.style.height = `${displaySize}px`;
    }

    function initCanvas(size) {
        gridSize = size;
        canvas.width = size;
        canvas.height = size;
        gridCanvas.width = size;
        gridCanvas.height = size;
        cursorCanvas.width = size;
        cursorCanvas.height = size;
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, size, size);
        drawGrid();
        clearCursorHighlight();
        syncCanvasDisplaySize();
        history = [];
        saveState();
        renderPreview();
        updateStatusBar();
        isDrawingChanged = false;
    }

    function saveState() {
        history.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
        if (history.length > HISTORY_LIMIT) history.shift();
    }

    function restoreState() {
        if (history.length <= 1) return;
        history.pop();
        const prev = history[history.length - 1];
        ctx.putImageData(prev, 0, 0);
        renderPreview();
        markChanged();
    }

    function drawGrid() {
        const size = gridSize;
        gridCanvas.width = size;
        gridCanvas.height = size;
        gridCtx.clearRect(0, 0, size, size);
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
            x: Math.max(0, Math.min(gridSize - 1, x)),
            y: Math.max(0, Math.min(gridSize - 1, y)),
        };
    }

    function getRawGridCoords(event) {
        const p = getPointer(event);
        const rect = canvas.getBoundingClientRect();
        const scale = gridSize / rect.width;
        const x = Math.floor((p.clientX - rect.left) * scale);
        const y = Math.floor((p.clientY - rect.top) * scale);
        return { x, y };
    }

    function colorWithAlpha(hex, alphaHex) {
        const normalized = normalizeHex(hex);
        if (/^#[0-9A-F]{6}$/.test(normalized)) return `${normalized}${alphaHex}`;
        return "rgba(46, 204, 113, 0.4)";
    }

    function drawCursorHighlight(x, y) {
        cursorCtx.clearRect(0, 0, gridSize, gridSize);
        cursorCtx.fillStyle = colorWithAlpha(selectedColor, "66");
        cursorCtx.fillRect(x, y, 1, 1);

        cursorCtx.strokeStyle = "rgba(255, 255, 255, 0.9)";
        cursorCtx.lineWidth = 0.08;
        cursorCtx.strokeRect(x, y, 1, 1);

        cursorCtx.strokeStyle = "rgba(0, 0, 0, 0.3)";
        cursorCtx.lineWidth = 0.05;
        cursorCtx.strokeRect(x - 0.02, y - 0.02, 1.04, 1.04);
    }

    function clearCursorHighlight() {
        cursorCtx.clearRect(0, 0, gridSize, gridSize);
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
        if (currentSizeLabel) currentSizeLabel.textContent = `${gridSize} × ${gridSize}`;
        if (currentColorLabel) currentColorLabel.textContent = COLOR_NAMES[selectedColor] || selectedColor;
        if (currentColorDot) currentColorDot.style.backgroundColor = selectedColor;
    }

    function applyToolAtPoint(event) {
        const { x, y } = getCanvasPoint(event);
        if (selectedTool === "pencil") {
            setPixel(x, y, selectedColor);
        } else if (selectedTool === "eraser") {
            setPixel(x, y, "#FFFFFF");
        }
        renderPreview();
        markChanged();
    }

    function startDraw(event) {
        event.preventDefault();
        isDrawing = true;
        saveState();
        if (selectedTool === "fill") {
            const { x, y } = getCanvasPoint(event);
            floodFill(x, y, selectedColor);
            saveState();
            renderPreview();
            markChanged();
            isDrawing = false;
            return;
        }
        applyToolAtPoint(event);
    }

    function moveDraw(event) {
        if (!isDrawing || selectedTool === "fill") return;
        if (event.cancelable) event.preventDefault();
        applyToolAtPoint(event);
    }

    function stopDraw() {
        if (isDrawing && selectedTool !== "fill") saveState();
        isDrawing = false;
    }

    function clearCanvas() {
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        saveState();
        renderPreview();
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
            const sourceSize = Math.max(canvas.width, canvas.height) || 1;
            const scale = Math.max(1, Math.floor(EXPORT_TARGET_SIZE / sourceSize));
            const exportSize = sourceSize * scale;
            const exportCanvas = document.createElement("canvas");
            exportCanvas.width = exportSize;
            exportCanvas.height = exportSize;
            const exportCtx = exportCanvas.getContext("2d");
            if (!exportCtx) {
                resolve(null);
                return;
            }

            exportCtx.imageSmoothingEnabled = false;
            exportCtx.fillStyle = "#FFFFFF";
            exportCtx.fillRect(0, 0, exportSize, exportSize);
            exportCtx.drawImage(canvas, 0, 0, exportSize, exportSize);
            exportCanvas.toBlob(resolve, "image/png");
        });
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
        if (event.ctrlKey && event.key.toLowerCase() === "z") {
            event.preventDefault();
            restoreState();
            return;
        }
        if (event.target && ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)) return;
        const key = event.key.toLowerCase();
        if (key === "b") setTool("pencil");
        if (key === "e") setTool("eraser");
        if (key === "f") setTool("fill");
    }

    toolButtons.forEach((button) => {
        button.addEventListener("click", () => setTool(button.dataset.tool));
    });

    undoButton?.addEventListener("click", restoreState);
    clearButton?.addEventListener("click", clearCanvas);
    addCustomColorBtn?.addEventListener("click", () => customColorPicker?.click());

    gridSizeInputs.forEach((input) => {
        input.addEventListener("change", () => {
            if (!input.checked) return;
            if (isDrawingChanged) {
                const confirmed = window.confirm("Текущий рисунок будет очищен. Продолжить?");
                if (!confirmed) {
                    const prev = Array.from(gridSizeInputs).find((el) => Number(el.value) === gridSize);
                    if (prev) prev.checked = true;
                    return;
                }
            }
            initCanvas(Number(input.value));
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
        if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
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
    initCanvas(32);
    updateCategoryPreview();
    restoreDraftIfExists();
    setTool("pencil");
})();
