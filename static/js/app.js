// -*- coding: utf-8 -*-
/**
 * 拼豆图纸生成器 - 前端逻辑
 */

// ========== 全局状态 ==========
let currentData = null;
let zoomLevel = 1;
let selectedFile = null;
let editMode = false;       // 是否处于编辑模式
let paintColor = null;      // 当前画笔色号

// ========== DOM ==========
const $ = id => document.getElementById(id);

const uploadArea = $('uploadArea');
const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.accept = 'image/*';
fileInput.style.display = 'none';
document.body.appendChild(fileInput);

const uploadPlaceholder = $('uploadPlaceholder');
const uploadPreview = $('uploadPreview');
const previewImg = $('previewImg');
const reuploadBtn = $('reuploadBtn');
const boardCount = $('boardCount');
const boardWidth = $('boardWidth');
const boardHeight = $('boardHeight');
const totalInfo = $('totalInfo');
const precision = $('precision');
const precisionValue = $('precisionValue');
const maxColors = $('maxColors');
const generateBtn = $('generateBtn');
const loading = $('loading');
const welcome = $('welcome');
const result = $('result');
const gridCanvas = $('gridCanvas');
const ctx = gridCanvas.getContext('2d');

// ========== 初始化 ==========
function init() {
    bindEvents();
    updateBoardInfo();
}

// ========== 事件绑定 ==========
function bindEvents() {
    // 上传
    uploadArea.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', e => { if (e.target.files.length) handleFile(e.target.files[0]); });
    uploadArea.addEventListener('dragover', e => { e.preventDefault(); uploadArea.style.borderColor = '#667eea'; });
    uploadArea.addEventListener('dragleave', () => { uploadArea.style.borderColor = '#d0d0d0'; });
    uploadArea.addEventListener('drop', e => {
        e.preventDefault();
        uploadArea.style.borderColor = '#d0d0d0';
        if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
    });
    reuploadBtn.addEventListener('click', e => { e.stopPropagation(); resetUpload(); });

    // 板子规格变化
    boardWidth.addEventListener('change', syncFromBoard);
    boardHeight.addEventListener('change', syncFromBoard);

    // 精密度变化
    precision.addEventListener('input', syncFromPrecision);

    // 显示控制
    $('showGrid').addEventListener('change', () => { if (currentData) renderGrid(currentData); });
    $('showCode').addEventListener('change', () => { if (currentData) renderGrid(currentData); });
    $('showBg').addEventListener('change', () => { if (currentData) renderGrid(currentData); });

    // 颜色优化滑块
    $('tolerance').addEventListener('input', () => {
        $('toleranceValue').textContent = $('tolerance').value;
    });

    // 编辑模式开关
    $('editMode').addEventListener('change', e => {
        editMode = e.target.checked;
        $('editPanel').style.display = editMode ? 'flex' : 'none';
        $('canvasWrapper').classList.toggle('editing', editMode);
        if (editMode && currentData) buildEditPanel();
    });

    // 批量替换按钮
    $('replaceBtn').addEventListener('click', replaceAllColor);

    // 生成
    generateBtn.addEventListener('click', generate);

    // 导出按钮 → 弹窗
    $('exportBtn').addEventListener('click', showExportDialog);
    $('exportCancel').addEventListener('click', () => { $('exportDialog').style.display = 'none'; });
    $('exportConfirm').addEventListener('click', doExport);
    $('exportCellSize').addEventListener('change', updateExportPreview);

    // 缩放滑块
    $('zoomSlider').addEventListener('input', e => {
        zoomLevel = parseInt(e.target.value) / 100;
        $('zoomLevel').textContent = e.target.value + '%';
        if (currentData) renderGrid(currentData);
    });

    // Canvas 点击编辑
    gridCanvas.addEventListener('click', handleCanvasClick);
}

// ========== 参数联动 ==========
function adjustBoardCount(delta) {
    const val = Math.max(1, Math.min(100, parseInt(boardCount.value) + delta));
    boardCount.value = val;
    updateBoardInfo();
}

function syncFromBoard() {
    const bw = parseInt(boardWidth.value) || 29;
    const bh = parseInt(boardHeight.value) || 29;
    const prec = parseInt(precision.value) || 29;
    const cols = Math.ceil(prec / bw);
    const rows = Math.ceil(prec / bh);
    boardCount.value = cols * rows;
    const totalW = cols * bw;
    const totalH = rows * bh;
    precisionValue.textContent = `${totalW} × ${totalH}`;
    updateBoardInfo();
}

function syncFromPrecision() {
    const prec = parseInt(precision.value);
    const bw = parseInt(boardWidth.value) || 29;
    const bh = parseInt(boardHeight.value) || 29;
    const cols = Math.ceil(prec / bw);
    const rows = Math.ceil(prec / bh);
    boardCount.value = cols * rows;
    const totalW = cols * bw;
    const totalH = rows * bh;
    precisionValue.textContent = `${totalW} × ${totalH}`;
    updateBoardInfo();
}

function setPrecision(val) {
    precision.value = val;
    syncFromPrecision();
}

function updateBoardInfo() {
    const count = parseInt(boardCount.value) || 1;
    const bw = parseInt(boardWidth.value) || 29;
    const bh = parseInt(boardHeight.value) || 29;
    const prec = parseInt(precision.value) || 29;
    const cols = Math.ceil(prec / bw);
    const rows = Math.ceil(prec / bh);
    const totalW = cols * bw;
    const totalH = rows * bh;
    const total = totalW * totalH;
    totalInfo.innerHTML = `${cols}×${rows} = ${count} 块 ${bw}×${bh}，总计 <strong>${totalW}×${totalH} = ${total.toLocaleString()} 颗</strong>`;
}

// ========== 文件处理 ==========
function handleFile(file) {
    if (!file.type.startsWith('image/')) { alert('请上传图片文件！'); return; }
    selectedFile = file;
    const reader = new FileReader();
    reader.onload = e => {
        previewImg.src = e.target.result;
        uploadPlaceholder.style.display = 'none';
        uploadPreview.style.display = 'block';
        generateBtn.disabled = false;
    };
    reader.readAsDataURL(file);
}

function resetUpload() {
    selectedFile = null;
    fileInput.value = '';
    previewImg.src = '';
    uploadPlaceholder.style.display = 'block';
    uploadPreview.style.display = 'none';
    generateBtn.disabled = true;
}

// ========== 缩放 ==========
function updateZoomSlider() {
    $('zoomSlider').value = Math.round(zoomLevel * 100);
    $('zoomLevel').textContent = Math.round(zoomLevel * 100) + '%';
}

// ========== 生成图纸 ==========
async function generate() {
    if (!selectedFile) return;

    loading.style.display = 'flex';
    welcome.style.display = 'none';
    result.style.display = 'none';
    generateBtn.disabled = true;

    const prec = parseInt(precision.value) || 29;
    const bw = parseInt(boardWidth.value) || 29;
    const bh = parseInt(boardHeight.value) || 29;
    const cols = Math.ceil(prec / bw);
    const rows = Math.ceil(prec / bh);
    const totalW = cols * bw;
    const totalH = rows * bh;

    const formData = new FormData();
    formData.append('image', selectedFile);
    formData.append('grid_size', Math.max(totalW, totalH));
    formData.append('brand', 'mard');
    formData.append('tolerance', $('tolerance').value);
    const mc = maxColors.value;
    if (mc) formData.append('max_colors', mc);

    try {
        const resp = await fetch('/api/upload', { method: 'POST', body: formData });
        const data = await resp.json();

        if (data.error) {
            alert('生成失败: ' + data.error);
            welcome.style.display = 'flex';
            return;
        }

        data.boardCount = parseInt(boardCount.value);
        data.boardWidth = bw;
        data.boardHeight = bh;
        data.boardCols = cols;
        data.boardRows = rows;

        currentData = data;
        displayResult(data);
    } catch (e) {
        alert('请求失败: ' + e.message);
        welcome.style.display = 'flex';
    } finally {
        loading.style.display = 'none';
        generateBtn.disabled = false;
    }
}

// ========== 展示结果 ==========
function displayResult(data) {
    result.style.display = 'flex';
    result.style.flexDirection = 'column';

    $('infoSize').textContent = `${data.boardCols}×${data.boardRows} = ${data.boardCount}块 ${data.boardWidth}×${data.boardHeight}`;
    $('infoBeads').textContent = `${data.total_beads.toLocaleString()} 颗豆`;
    $('infoColors').textContent = `${data.color_stats.length} 种颜色`;

    zoomLevel = 1;
    updateZoomSlider();

    renderGrid(data);
    renderColorStats(data);
    if (editMode) buildEditPanel();
}

// ========== 编辑面板 ==========
function buildEditPanel() {
    if (!currentData) return;

    // 画笔色号选择条
    const bar = $('paintColorBar');
    bar.innerHTML = '';
    currentData.color_stats.forEach(stat => {
        const [r, g, b] = stat.rgb;
        const item = document.createElement('div');
        item.className = 'color-pick-item' + (paintColor === stat.code ? ' active' : '');
        item.style.background = `rgb(${r},${g},${b})`;
        item.title = stat.code;
        item.addEventListener('click', () => {
            paintColor = stat.code;
            bar.querySelectorAll('.color-pick-item').forEach(el => el.classList.remove('active'));
            item.classList.add('active');
        });
        bar.appendChild(item);
    });

    // 批量替换下拉框
    const replaceFrom = $('replaceFrom');
    const replaceTo = $('replaceTo');
    replaceFrom.innerHTML = '<option value="">原色</option>';
    replaceTo.innerHTML = '<option value="">目标色</option>';

    // 加载完整色卡到目标色下拉
    fetch('/api/color_card/mard')
        .then(r => r.json())
        .then(card => {
            // 当前使用的颜色 → 原色下拉
            currentData.color_stats.forEach(stat => {
                const opt = document.createElement('option');
                opt.value = stat.code;
                opt.textContent = `${stat.code} (${stat.count}颗)`;
                replaceFrom.appendChild(opt);
            });
            // 全部色卡 → 目标色下拉
            card.colors.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.code;
                opt.textContent = c.code;
                replaceTo.appendChild(opt);
            });
        });

    // 默认选中第一个颜色
    if (!paintColor && currentData.color_stats.length > 0) {
        paintColor = currentData.color_stats[0].code;
        bar.firstChild.classList.add('active');
    }
}

// ========== 批量替换颜色 ==========
function replaceAllColor() {
    if (!currentData) return;
    const fromCode = $('replaceFrom').value;
    const toCode = $('replaceTo').value;
    if (!fromCode || !toCode) { alert('请选择原色和目标色'); return; }
    if (fromCode === toCode) return;

    // 找到目标色的RGB
    let toColor = null;
    // 先从当前数据的颜色统计里找
    for (const stat of currentData.color_stats) {
        if (stat.code === toCode) { toColor = stat; break; }
    }
    // 如果没找到，从色卡里找
    if (!toColor) {
        fetch('/api/color_card/mard')
            .then(r => r.json())
            .then(card => {
                const found = card.colors.find(c => c.code === toCode);
                if (found) doReplace(fromCode, { code: found.code, name: found.name, rgb: found.rgb });
            });
    } else {
        doReplace(fromCode, toColor);
    }
}

function doReplace(fromCode, toColor) {
    let replaced = 0;
    const grid = currentData.grid;
    for (let row = 0; row < grid.length; row++) {
        for (let col = 0; col < grid[row].length; col++) {
            if (grid[row][col].code === fromCode) {
                grid[row][col].code = toColor.code;
                grid[row][col].name = toColor.name;
                grid[row][col].rgb = toColor.rgb;
                replaced++;
            }
        }
    }

    // 重新统计颜色
    rebuildColorStats();
    renderGrid(currentData);
    renderColorStats(currentData);
    buildEditPanel();
    alert(`已将 ${fromCode} 替换为 ${toColor.code}，共 ${replaced} 颗`);
}

// ========== Canvas 点击编辑 ==========
function handleCanvasClick(e) {
    if (!editMode || !currentData || !paintColor) return;

    const rect = gridCanvas.getBoundingClientRect();
    const scaleX = gridCanvas.width / rect.width;
    const scaleY = gridCanvas.height / rect.height;
    const canvasX = (e.clientX - rect.left) * scaleX;
    const canvasY = (e.clientY - rect.top) * scaleY;

    // 计算点击的是哪个格子
    const { boardWidth: bw, boardHeight: bh, boardCols, boardRows } = currentData;
    const cell = Math.round(Math.max(8, Math.min(28, Math.floor(($('canvasWrapper').clientWidth - 40) / currentData.width))) * zoomLevel);

    // 遍历板子找到点击位置
    for (let br = 0; br < boardRows; br++) {
        for (let bc = 0; bc < boardCols; bc++) {
            const ox = bc * bw * cell;
            const oy = br * bh * cell;
            if (canvasX >= ox && canvasX < ox + bw * cell && canvasY >= oy && canvasY < oy + bh * cell) {
                const col = Math.floor((canvasX - ox) / cell);
                const row = Math.floor((canvasY - oy) / cell);
                const gridCol = bc * bw + col;
                const gridRow = br * bh + row;

                if (gridRow < currentData.height && gridCol < currentData.width) {
                    // 找到目标色信息
                    let toColor = null;
                    for (const stat of currentData.color_stats) {
                        if (stat.code === paintColor) { toColor = stat; break; }
                    }
                    if (!toColor) return;

                    // 替换单格
                    currentData.grid[gridRow][gridCol].code = toColor.code;
                    currentData.grid[gridRow][gridCol].name = toColor.name;
                    currentData.grid[gridRow][gridCol].rgb = toColor.rgb;

                    rebuildColorStats();
                    renderGrid(currentData);
                    renderColorStats(currentData);
                    buildEditPanel();
                }
                return;
            }
        }
    }
}

// ========== 重建颜色统计 ==========
function rebuildColorStats() {
    const colorCount = {};
    const grid = currentData.grid;
    for (let row = 0; row < grid.length; row++) {
        for (let col = 0; col < grid[row].length; col++) {
            const cell = grid[row][col];
            const k = cell.code;
            if (!colorCount[k]) {
                colorCount[k] = { code: cell.code, name: cell.name, rgb: cell.rgb, count: 0 };
            }
            colorCount[k].count++;
        }
    }
    currentData.color_stats = Object.values(colorCount).sort((a, b) => b.count - a.count);
}

// ========== Canvas渲染网格 ==========
function renderGrid(data) {
    const { grid, width, height, color_stats, boardWidth: bw, boardHeight: bh, boardCols, boardRows } = data;
    const showGridLine = $('showGrid').checked;
    const showCodeText = $('showCode').checked;
    const showBgColor = $('showBg').checked;

    // 单元格大小
    const wrapper = $('canvasWrapper');
    const maxW = wrapper.clientWidth - 40;
    const baseCell = Math.max(8, Math.min(28, Math.floor(maxW / width)));
    const cell = Math.round(baseCell * zoomLevel);

    // 字体
    let fontSize;
    if (cell >= 28) fontSize = 11;
    else if (cell >= 20) fontSize = 9;
    else if (cell >= 14) fontSize = 7;
    else if (cell >= 10) fontSize = 6;
    else fontSize = 5;

    // 板子直接拼接
    const canvasW = boardCols * bw * cell + 1;
    const canvasH_grid = boardRows * bh * cell + 1;

    // 底部统计区高度
    const statsRows = Math.ceil(color_stats.length / Math.max(1, Math.floor(canvasW / 85)));
    const statsH = statsRows * 28 + 50;
    const canvasH = canvasH_grid + statsH;

    gridCanvas.width = canvasW;
    gridCanvas.height = canvasH;
    gridCanvas.style.width = canvasW + 'px';
    gridCanvas.style.height = canvasH + 'px';

    // 白色背景
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvasW, canvasH);

    // 按板子绘制
    for (let br = 0; br < boardRows; br++) {
        for (let bc_i = 0; bc_i < boardCols; bc_i++) {
            const ox = bc_i * bw * cell;
            const oy = br * bh * cell;

            // 绘制底色和色号
            for (let row = 0; row < bh; row++) {
                for (let col = 0; col < bw; col++) {
                    const gridCol = bc_i * bw + col;
                    const gridRow = br * bh + row;
                    if (gridRow >= height || gridCol >= width) continue;

                    const cellData = grid[gridRow][gridCol];
                    const x = ox + col * cell;
                    const y = oy + row * cell;

                    // 底色
                    if (showBgColor) {
                        const [r, g, b] = cellData.rgb;
                        ctx.fillStyle = `rgb(${r},${g},${b})`;
                        ctx.fillRect(x, y, cell, cell);
                    }

                    // 色号文字
                    if (showCodeText && cell >= 12) {
                        const [r, g, b] = cellData.rgb;
                        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
                        ctx.fillStyle = brightness > 140 ? '#000' : '#fff';
                        ctx.font = `bold ${fontSize}px Arial`;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(cellData.code, x + cell / 2, y + cell / 2);
                    }
                }
            }

            // 普通网格线
            if (showGridLine && cell >= 5) {
                ctx.strokeStyle = 'rgba(0,0,0,0.12)';
                ctx.lineWidth = 0.3;
                for (let row = 0; row <= bh; row++) {
                    ctx.beginPath();
                    ctx.moveTo(ox, oy + row * cell);
                    ctx.lineTo(ox + bw * cell, oy + row * cell);
                    ctx.stroke();
                }
                for (let col = 0; col <= bw; col++) {
                    ctx.beginPath();
                    ctx.moveTo(ox + col * cell, oy);
                    ctx.lineTo(ox + col * cell, oy + bh * cell);
                    ctx.stroke();
                }
            }

            // 10×10区域外框线（红色粗线）
            if (showGridLine && cell >= 5) {
                ctx.strokeStyle = '#FF0000';
                ctx.lineWidth = 1.5;
                const blocksX = Math.ceil(bw / 10);
                const blocksY = Math.ceil(bh / 10);
                for (let by = 0; by < blocksY; by++) {
                    for (let bx = 0; bx < blocksX; bx++) {
                        const bx1 = ox + bx * 10 * cell;
                        const by1 = oy + by * 10 * cell;
                        const bw_block = Math.min(10, bw - bx * 10) * cell;
                        const bh_block = Math.min(10, bh - by * 10) * cell;
                        ctx.strokeRect(bx1, by1, bw_block, bh_block);
                    }
                }
            }
        }
    }

    // 板子连接线
    if (boardCols > 1 || boardRows > 1) {
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        for (let c = 1; c < boardCols; c++) {
            const x = c * bw * cell;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, boardRows * bh * cell);
            ctx.stroke();
        }
        for (let r = 1; r < boardRows; r++) {
            const y = r * bh * cell;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(boardCols * bw * cell, y);
            ctx.stroke();
        }
    }

    // 整体外框
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, boardCols * bw * cell, boardRows * bh * cell);

    // 底部颜色统计
    let sx = 8;
    let sy = canvasH_grid + 8;
    const barH = 22;
    const barGap = 6;

    ctx.fillStyle = '#333';
    ctx.font = 'bold 12px Microsoft YaHei, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`颜色用量统计（共 ${data.total_beads.toLocaleString()} 颗豆）`, sx, sy);
    sy += 24;

    ctx.font = '10px Microsoft YaHei, sans-serif';
    for (const stat of color_stats) {
        const [r, g, b] = stat.rgb;
        const text = `${stat.code} ×${stat.count}`;
        const tw = ctx.measureText(text).width;
        const barW = Math.max(tw + 16, 55);

        if (sx + barW > canvasW - 8) {
            sx = 8;
            sy += barH + barGap;
        }

        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(sx, sy, barW, barH);
        ctx.strokeStyle = '#999';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(sx, sy, barW, barH);

        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        ctx.fillStyle = brightness > 140 ? '#000' : '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, sx + barW / 2, sy + barH / 2);

        sx += barW + barGap;
    }
}

// ========== 颜色统计面板 ==========
function renderColorStats(data) {
    const statsTable = $('statsTable');
    const statsTotal = $('statsTotal');
    statsTable.innerHTML = '';

    data.color_stats.forEach(stat => {
        const [r, g, b] = stat.rgb;
        const item = document.createElement('div');
        item.className = 'stat-item';
        item.innerHTML = `
            <div class="stat-color" style="background:rgb(${r},${g},${b})"></div>
            <span class="stat-code">${stat.code}</span>
            <span class="stat-count">×${stat.count}</span>
        `;
        statsTable.appendChild(item);
    });

    statsTotal.textContent = `总计：${data.total_beads.toLocaleString()} 颗豆`;
}

// ========== 导出 ==========
function showExportDialog() {
    if (!currentData) return;
    $('exportDialog').style.display = 'flex';
    updateExportPreview();
}

function updateExportPreview() {
    const cell = parseInt($('exportCellSize').value);
    const { width, height } = currentData;
    const w = width * cell;
    const h = height * cell;
    $('exportPreview').textContent = `预计尺寸：${w} × ${h} 像素（${(w * h / 1000000).toFixed(1)}MP）`;
}

function doExport() {
    const cell = parseInt($('exportCellSize').value);
    const fontSize = parseInt($('exportFontSize').value);
    const showBg = $('exportBg').checked;
    const showGrid = $('exportGrid').checked;
    const showCode = $('exportCode').checked;
    const showStats = $('exportStats').checked;

    const { grid, width, height, color_stats, boardWidth: bw, boardHeight: bh, boardCols, boardRows } = currentData;

    const gridW = boardCols * bw * cell;
    const gridH = boardRows * bh * cell;

    // 统计区高度
    let statsH = 0;
    if (showStats) {
        const statsRows = Math.ceil(color_stats.length / Math.max(1, Math.floor(gridW / 85)));
        statsH = statsRows * (fontSize + 14) + 50;
    }

    const canvasH = gridH + statsH;

    // 创建临时 canvas
    const tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = gridW;
    tmpCanvas.height = canvasH;
    const tc = tmpCanvas.getContext('2d');

    // 白色背景
    tc.fillStyle = '#fff';
    tc.fillRect(0, 0, gridW, canvasH);

    // 绘制格子
    for (let br = 0; br < boardRows; br++) {
        for (let bc = 0; bc < boardCols; bc++) {
            const ox = bc * bw * cell;
            const oy = br * bh * cell;

            for (let row = 0; row < bh; row++) {
                for (let col = 0; col < bw; col++) {
                    const gc = bc * bw + col;
                    const gr = br * bh + row;
                    if (gr >= height || gc >= width) continue;

                    const cellData = grid[gr][gc];
                    const x = ox + col * cell;
                    const y = oy + row * cell;

                    if (showBg) {
                        const [r, g, b] = cellData.rgb;
                        tc.fillStyle = `rgb(${r},${g},${b})`;
                        tc.fillRect(x, y, cell, cell);
                    }

                    if (showCode) {
                        const [r, g, b] = cellData.rgb;
                        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
                        tc.fillStyle = brightness > 140 ? '#000' : '#fff';
                        tc.font = `bold ${fontSize}px Arial`;
                        tc.textAlign = 'center';
                        tc.textBaseline = 'middle';
                        tc.fillText(cellData.code, x + cell / 2, y + cell / 2);
                    }
                }
            }

            // 网格线
            if (showGrid) {
                tc.strokeStyle = 'rgba(0,0,0,0.12)';
                tc.lineWidth = 0.5;
                for (let row = 0; row <= bh; row++) {
                    tc.beginPath();
                    tc.moveTo(ox, oy + row * cell);
                    tc.lineTo(ox + bw * cell, oy + row * cell);
                    tc.stroke();
                }
                for (let col = 0; col <= bw; col++) {
                    tc.beginPath();
                    tc.moveTo(ox + col * cell, oy);
                    tc.lineTo(ox + col * cell, oy + bh * cell);
                    tc.stroke();
                }

                // 10×10 红色外框
                tc.strokeStyle = '#FF0000';
                tc.lineWidth = 1.5;
                const bxCount = Math.ceil(bw / 10);
                const byCount = Math.ceil(bh / 10);
                for (let by = 0; by < byCount; by++) {
                    for (let bx = 0; bx < bxCount; bx++) {
                        tc.strokeRect(
                            ox + bx * 10 * cell,
                            oy + by * 10 * cell,
                            Math.min(10, bw - bx * 10) * cell,
                            Math.min(10, bh - by * 10) * cell
                        );
                    }
                }
            }
        }
    }

    // 板子连接线
    if (boardCols > 1 || boardRows > 1) {
        tc.strokeStyle = '#000';
        tc.lineWidth = 3;
        for (let c = 1; c < boardCols; c++) {
            tc.beginPath();
            tc.moveTo(c * bw * cell, 0);
            tc.lineTo(c * bw * cell, gridH);
            tc.stroke();
        }
        for (let r = 1; r < boardRows; r++) {
            tc.beginPath();
            tc.moveTo(0, r * bh * cell);
            tc.lineTo(gridW, r * bh * cell);
            tc.stroke();
        }
    }

    // 整体外框
    tc.strokeStyle = '#000';
    tc.lineWidth = 3;
    tc.strokeRect(0, 0, gridW, gridH);

    // 颜色统计
    if (showStats) {
        let sx = 8;
        let sy = gridH + 8;
        const barH = fontSize + 12;
        tc.fillStyle = '#333';
        tc.font = `bold ${fontSize + 2}px Microsoft YaHei, sans-serif`;
        tc.textAlign = 'left';
        tc.textBaseline = 'top';
        tc.fillText(`颜色用量统计（共 ${currentData.total_beads.toLocaleString()} 颗豆）`, sx, sy);
        sy += fontSize + 16;

        tc.font = `${fontSize}px Microsoft YaHei, sans-serif`;
        for (const stat of color_stats) {
            const [r, g, b] = stat.rgb;
            const text = `${stat.code} ×${stat.count}`;
            const tw = tc.measureText(text).width;
            const barW = Math.max(tw + 16, 55);

            if (sx + barW > gridW - 8) { sx = 8; sy += barH + 4; }

            tc.fillStyle = `rgb(${r},${g},${b})`;
            tc.fillRect(sx, sy, barW, barH);
            tc.strokeStyle = '#999';
            tc.lineWidth = 0.5;
            tc.strokeRect(sx, sy, barW, barH);

            const brightness = (r * 299 + g * 587 + b * 114) / 1000;
            tc.fillStyle = brightness > 140 ? '#000' : '#fff';
            tc.textAlign = 'center';
            tc.textBaseline = 'middle';
            tc.fillText(text, sx + barW / 2, sy + barH / 2);

            sx += barW + 4;
        }
    }

    // 下载
    const link = document.createElement('a');
    link.download = `拼豆图纸_${width}x${height}_${cell}px.png`;
    link.href = tmpCanvas.toDataURL('image/png');
    link.click();

    $('exportDialog').style.display = 'none';
}

// ========== 启动 ==========
init();
