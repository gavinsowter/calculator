// =========================================================
// GRAPH MODE
// Draws y = f(x) on a <canvas>, like Desmos (a mini version).
//
// The big idea: the canvas works in PIXELS, but math works in
// x and y UNITS. So we keep a "view" (where the center is and
// how many pixels one unit takes) and convert back and forth.
// =========================================================


// ----- SETTINGS -----
const COLORS = ["#ff9f1c", "#4fd1c5", "#ff6b9a", "#7aa2ff", "#9be564", "#c792ea"];
const MAX_FUNCTIONS = 6;
const DEFAULT_VIEW = { centerX: 0, centerY: 0, scale: 40 };   // scale = pixels per 1 unit

// ----- STATE -----
let view = { ...DEFAULT_VIEW };     // { ...x } makes a COPY of the object
let functions = [];                 // each: { text, color, compiled, error }
let mouse = null;                   // where the mouse is over the canvas (for tracing)

// ----- PAGE PARTS -----
const canvas       = document.querySelector("#graph-canvas");
const ctx          = canvas.getContext("2d");    // the "pen" we draw with
const functionList = document.querySelector("#function-list");
const addButton    = document.querySelector("#add-function");
const traceText    = document.querySelector("#trace");


// =========================================================
// CONVERTING BETWEEN PIXELS AND MATH UNITS
// =========================================================
// canvas.clientWidth/Height = the canvas size in CSS pixels
function toPixelX(x) { return canvas.clientWidth / 2 + (x - view.centerX) * view.scale; }
function toPixelY(y) { return canvas.clientHeight / 2 - (y - view.centerY) * view.scale; }   // minus: pixels go DOWN, math y goes UP
function toMathX(px) { return view.centerX + (px - canvas.clientWidth / 2) / view.scale; }
function toMathY(py) { return view.centerY - (py - canvas.clientHeight / 2) / view.scale; }


// =========================================================
// THE FUNCTION LIST (left side)
// =========================================================
function addFunction(text) {
    if (functions.length >= MAX_FUNCTIONS) return;

    // pick the first color nobody is using
    const usedColors = functions.map(function (f) { return f.color; });
    const color = COLORS.find(function (c) { return !usedColors.includes(c); });

    const fn = { text: text, color: color, compiled: null, error: null };
    functions.push(fn);
    compileFunction(fn);
    renderFunctionList();
    draw();
}

// turns the text into a fast function of x (using parser.js)
function compileFunction(fn) {
    // let people type "y = x^2" or "f(x) = x^2" too: strip the front part
    const text = fn.text.replace(/^\s*(y|f\(x\))\s*=/i, "").trim();

    if (text === "") {
        fn.compiled = null;
        fn.error = null;
        return;
    }
    try {
        const run = compile(parse(text), { degrees: false });
        fn.compiled = function (x) { return run({ x: x, ans: 0 }); };
        fn.error = null;
    } catch (error) {
        fn.compiled = null;
        fn.error = error.message;
    }
}

// rebuilds the rows on the left side
function renderFunctionList() {
    functionList.innerHTML = "";

    functions.forEach(function (fn, index) {
        const row = document.createElement("div");
        row.className = "function-row";

        // colored dot + "y =" label
        const label = document.createElement("label");
        label.className = "function-label";
        label.htmlFor = `fn-${index}`;
        label.innerHTML = `<span class="dot"></span>y =`;
        label.querySelector(".dot").style.background = fn.color;

        // the text box
        const input = document.createElement("input");
        input.id = `fn-${index}`;
        input.className = "function-input";
        input.type = "text";
        input.value = fn.text;
        input.placeholder = "e.g. x^2 - 3";
        input.spellcheck = false;
        input.autocomplete = "off";
        input.style.borderColor = fn.color;

        // the error message under the box (empty when it's fine)
        const errorText = document.createElement("p");
        errorText.className = "function-error";
        errorText.textContent = fn.error || "";

        // redraw every time you type
        input.addEventListener("input", function () {
            fn.text = input.value;
            compileFunction(fn);
            errorText.textContent = fn.error || "";
            draw();
        });

        // remove button
        const remove = document.createElement("button");
        remove.className = "remove-button";
        remove.textContent = "×";
        remove.setAttribute("aria-label", `Remove function ${index + 1}`);
        remove.addEventListener("click", function () {
            functions.splice(index, 1);     // splice removes items from an array
            renderFunctionList();
            draw();
        });

        const line = document.createElement("div");
        line.className = "function-line";
        line.append(label, input, remove);
        row.append(line, errorText);
        functionList.appendChild(row);
    });

    addButton.disabled = functions.length >= MAX_FUNCTIONS;
}


// =========================================================
// DRAWING
// =========================================================

// Picks a "nice" grid spacing (1, 2, 5, 10, 20, 50…) so the
// lines are never too crowded or too far apart when zooming.
function niceStep() {
    const roughStep = 80 / view.scale;   // about 80 pixels between labeled lines
    const power = Math.pow(10, Math.floor(Math.log10(roughStep)));
    const fraction = roughStep / power;
    if (fraction < 1.5) return 1 * power;
    if (fraction < 3.5) return 2 * power;
    if (fraction < 7.5) return 5 * power;
    return 10 * power;
}

// short labels: 0.5 not 0.5000000001, and 1e6 for big numbers
function axisLabel(value) {
    const tidy = Number(value.toPrecision(10));
    if (tidy !== 0 && (Math.abs(tidy) >= 1e6 || Math.abs(tidy) < 1e-4)) {
        return tidy.toExponential(0);
    }
    return String(tidy);
}

function draw() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width === 0 || height === 0) return;   // hidden, nothing to draw

    // background
    ctx.fillStyle = "#0f1115";
    ctx.fillRect(0, 0, width, height);

    const step = niceStep();
    const minX = toMathX(0), maxX = toMathX(width);
    const minY = toMathY(height), maxY = toMathY(0);

    // ----- MINOR GRID (faint lines, 5 per labeled step) -----
    ctx.strokeStyle = "#181b22";
    ctx.lineWidth = 1;
    ctx.beginPath();
    const minor = step / 5;
    for (let x = Math.ceil(minX / minor) * minor; x <= maxX; x += minor) {
        const px = Math.round(toPixelX(x)) + 0.5;   // +0.5 makes 1px lines sharp
        ctx.moveTo(px, 0); ctx.lineTo(px, height);
    }
    for (let y = Math.ceil(minY / minor) * minor; y <= maxY; y += minor) {
        const py = Math.round(toPixelY(y)) + 0.5;
        ctx.moveTo(0, py); ctx.lineTo(width, py);
    }
    ctx.stroke();

    // ----- MAJOR GRID -----
    ctx.strokeStyle = "#262b36";
    ctx.beginPath();
    for (let x = Math.ceil(minX / step) * step; x <= maxX; x += step) {
        const px = Math.round(toPixelX(x)) + 0.5;
        ctx.moveTo(px, 0); ctx.lineTo(px, height);
    }
    for (let y = Math.ceil(minY / step) * step; y <= maxY; y += step) {
        const py = Math.round(toPixelY(y)) + 0.5;
        ctx.moveTo(0, py); ctx.lineTo(width, py);
    }
    ctx.stroke();

    // ----- AXES (the x and y lines through 0) -----
    // If the axis is off screen, keep it stuck to the edge so labels stay visible
    const axisX = Math.min(Math.max(toPixelY(0), 0), height);   // where the x-axis is drawn (a y pixel)
    const axisY = Math.min(Math.max(toPixelX(0), 0), width);    // where the y-axis is drawn (an x pixel)
    ctx.strokeStyle = "#8a90a0";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, Math.round(axisX) + 0.5); ctx.lineTo(width, Math.round(axisX) + 0.5);
    ctx.moveTo(Math.round(axisY) + 0.5, 0); ctx.lineTo(Math.round(axisY) + 0.5, height);
    ctx.stroke();

    // ----- NUMBER LABELS on the axes -----
    ctx.fillStyle = "#9aa0ad";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (let x = Math.ceil(minX / step) * step; x <= maxX; x += step) {
        if (Math.abs(x) < step / 2) continue;                  // skip 0 (it's at the corner)
        const labelY = Math.min(axisX + 4, height - 16);       // keep inside the canvas
        ctx.fillText(axisLabel(x), toPixelX(x), labelY);
    }
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let y = Math.ceil(minY / step) * step; y <= maxY; y += step) {
        if (Math.abs(y) < step / 2) continue;
        const labelX = Math.max(axisY - 6, 30);
        ctx.fillText(axisLabel(y), labelX, toPixelY(y));
    }

    // ----- THE FUNCTIONS -----
    functions.forEach(function (fn) {
        if (fn.compiled) drawFunction(fn, width, height);
    });

    drawTrace();
}

// Draws one curve by checking y at every pixel across the screen
// and connecting the dots.
function drawFunction(fn, width, height) {
    ctx.strokeStyle = fn.color;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = "round";
    ctx.beginPath();

    let penDown = false;     // are we in the middle of a line?
    let lastPy = null;

    // step by half a pixel for smooth curves
    for (let px = 0; px <= width; px += 0.5) {
        const y = fn.compiled(toMathX(px));
        const py = toPixelY(y);

        // lift the pen when y doesn't exist (like sqrt(-1)), or when the
        // curve jumps wildly (like tan(x) at its asymptotes)
        const broken = !Number.isFinite(y) ||
            (lastPy !== null && Math.abs(py - lastPy) > height * 2);

        if (broken) {
            penDown = false;
            lastPy = Number.isFinite(y) ? py : null;
            continue;
        }

        // clamp crazy values so the canvas doesn't choke on huge numbers
        const clampedPy = Math.max(-height * 5, Math.min(height * 6, py));

        if (penDown) {
            ctx.lineTo(px, clampedPy);
        } else {
            ctx.moveTo(px, clampedPy);
            penDown = true;
        }
        lastPy = py;
    }
    ctx.stroke();
}

// TRACE: when the mouse is near a curve, show a dot and its (x, y)
function drawTrace() {
    traceText.textContent = "";
    if (!mouse) return;

    const x = toMathX(mouse.x);
    let best = null;

    // find the curve closest to the mouse at this x
    functions.forEach(function (fn) {
        if (!fn.compiled) return;
        const y = fn.compiled(x);
        if (!Number.isFinite(y)) return;
        const distance = Math.abs(toPixelY(y) - mouse.y);
        if (distance < 30 && (!best || distance < best.distance)) {
            best = { fn: fn, y: y, distance: distance };
        }
    });

    if (!best) return;

    const px = mouse.x;
    const py = toPixelY(best.y);
    const label = `(${formatResult(Number(x.toFixed(4)))}, ${formatResult(Number(best.y.toFixed(4)))})`;

    // the dot
    ctx.fillStyle = best.fn.color;
    ctx.beginPath();
    ctx.arc(px, py, 5, 0, Math.PI * 2);   // a full circle
    ctx.fill();

    // the label in a dark box next to the dot
    ctx.font = "13px system-ui, sans-serif";
    const boxWidth = ctx.measureText(label).width + 14;
    const boxX = Math.min(px + 10, canvas.clientWidth - boxWidth - 4);
    const boxY = Math.max(py - 32, 4);
    ctx.fillStyle = "rgba(15, 17, 21, 0.9)";
    ctx.fillRect(boxX, boxY, boxWidth, 24);
    ctx.fillStyle = "#f3f4f7";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(label, boxX + 7, boxY + 12);

    traceText.textContent = `Tracing y = ${best.fn.text}: ${label}`;
}


// =========================================================
// CANVAS SIZE
// Canvases have their OWN pixel size, separate from their CSS size.
// On sharp "Retina" screens there are 2 real pixels per CSS pixel,
// so we make the canvas bigger and scale the pen to match.
// Otherwise everything looks blurry.
// =========================================================
function resizeCanvas() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(canvas.clientWidth * ratio);
    canvas.height = Math.round(canvas.clientHeight * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);   // draw in CSS pixels from now on
    draw();
}

// ResizeObserver tells us whenever the canvas changes size
new ResizeObserver(resizeCanvas).observe(canvas);
window.addEventListener("graph-shown", resizeCanvas);


// =========================================================
// MOVING AROUND: drag to pan, scroll/buttons to zoom
// "pointer" events work for mouse, touch and pen all at once.
// =========================================================
let drag = null;   // where a drag started

canvas.addEventListener("pointerdown", function (event) {
    drag = { x: event.clientX, y: event.clientY, centerX: view.centerX, centerY: view.centerY };
    canvas.setPointerCapture(event.pointerId);   // keep getting moves even outside the canvas
    canvas.classList.add("dragging");
});

canvas.addEventListener("pointermove", function (event) {
    const rect = canvas.getBoundingClientRect();
    mouse = { x: event.clientX - rect.left, y: event.clientY - rect.top };

    if (drag) {
        // move the view by how far the mouse moved (converted to math units)
        view.centerX = drag.centerX - (event.clientX - drag.x) / view.scale;
        view.centerY = drag.centerY + (event.clientY - drag.y) / view.scale;
    }
    draw();
});

function endDrag() {
    drag = null;
    canvas.classList.remove("dragging");
}
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);
canvas.addEventListener("pointerleave", function () {
    mouse = null;
    draw();
});

// zoom by "factor", keeping the point under (px, py) in the same spot
function zoom(factor, px, py) {
    const before = { x: toMathX(px), y: toMathY(py) };
    view.scale = Math.min(Math.max(view.scale * factor, 0.0001), 1e7);   // limits
    const after = { x: toMathX(px), y: toMathY(py) };
    view.centerX += before.x - after.x;
    view.centerY += before.y - after.y;
    draw();
}

canvas.addEventListener("wheel", function (event) {
    event.preventDefault();   // don't scroll the page
    const rect = canvas.getBoundingClientRect();
    // scrolling up (negative deltaY) zooms in
    zoom(Math.exp(-event.deltaY * 0.0015), event.clientX - rect.left, event.clientY - rect.top);
}, { passive: false });

document.querySelector("#zoom-in").addEventListener("click", function () {
    zoom(1.5, canvas.clientWidth / 2, canvas.clientHeight / 2);
});
document.querySelector("#zoom-out").addEventListener("click", function () {
    zoom(1 / 1.5, canvas.clientWidth / 2, canvas.clientHeight / 2);
});
document.querySelector("#zoom-reset").addEventListener("click", function () {
    view = { ...DEFAULT_VIEW };
    draw();
});

addButton.addEventListener("click", function () {
    addFunction("");
    // jump into the new empty box
    const inputs = functionList.querySelectorAll(".function-input");
    inputs[inputs.length - 1].focus();
});


// =========================================================
// START with two example functions
// =========================================================
addFunction("sin(x)");
addFunction("x^2/4 - 2");
