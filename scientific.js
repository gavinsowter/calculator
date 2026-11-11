// =========================================================
// TABS + SCIENTIFIC MODE
// =========================================================


// =========================================================
// TABS: show one panel, hide the others
// =========================================================
const tabs = document.querySelectorAll(".tab");

tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
        tabs.forEach(function (t) {
            const isThisOne = t === tab;
            t.setAttribute("aria-selected", isThisOne ? "true" : "false");
            // the "hidden" property hides an element completely
            document.getElementById(t.dataset.panel).hidden = !isThisOne;
        });

        // the graph needs to resize once it's visible (it can't measure itself while hidden)
        if (tab.dataset.panel === "graph-panel") {
            window.dispatchEvent(new Event("graph-shown"));
        }
        if (tab.dataset.panel === "sci-panel") {
            sciInput.focus();
        }
    });
});


// =========================================================
// SCIENTIFIC CALCULATOR
// =========================================================

// ----- STATE -----
let useDegrees = true;   // DEG or RAD for sin/cos/tan
let lastAnswer = 0;      // "ans" button uses this
let justAnswered = false; // true right after "=" (like startNewNumber in the basic one)

// ----- PAGE PARTS -----
const sciInput    = document.querySelector("#sci-input");
const sciPreview  = document.querySelector("#sci-preview");
const angleButton = document.querySelector("#angle-mode");
const sciHistory  = document.querySelector("#sci-history");


// Works out the expression in the box.
// Returns { value } if it worked, or { error } if not.
function solve(text) {
    try {
        // "try" runs code that might fail; if it throws an error,
        // we jump to "catch" instead of crashing the whole page.
        const value = evaluate(text, { ans: lastAnswer, x: 0 }, { degrees: useDegrees });
        return { value: value };
    } catch (error) {
        return { error: error.message };
    }
}

// LIVE PREVIEW: shows the answer while you type, before pressing =
function updatePreview() {
    const text = sciInput.value.trim();
    if (text === "") {
        sciPreview.textContent = "";
        return;
    }
    const result = solve(text);
    // only show a preview when it works (no red errors mid-typing)
    sciPreview.textContent = result.error ? "" : "= " + formatResult(result.value);
}


// INSERT TEXT where the blinking cursor is
function insertText(text) {
    // after an answer, typing a NUMBER or FUNCTION starts fresh,
    // but typing an OPERATOR keeps going from the answer (like 5 then "+2")
    if (justAnswered) {
        const continues = /^[+×÷−^!%²)]/.test(text);
        if (!continues) {
            sciInput.value = "";
        }
        justAnswered = false;
    }

    // selectionStart/End = where the cursor is (or what's highlighted)
    const start = sciInput.selectionStart ?? sciInput.value.length;
    const end = sciInput.selectionEnd ?? sciInput.value.length;
    sciInput.value = sciInput.value.slice(0, start) + text + sciInput.value.slice(end);

    // put the cursor right after what we inserted
    const newPosition = start + text.length;
    sciInput.setSelectionRange(newPosition, newPosition);
    sciInput.focus();
    updatePreview();
}

function sciEquals() {
    const text = sciInput.value.trim();
    if (text === "") return;

    const result = solve(text);

    if (result.error) {
        // show the error in the preview line; leave the text so you can fix it
        sciPreview.textContent = "⚠ " + result.error;
        return;
    }
    if (Number.isNaN(result.value)) {
        sciPreview.textContent = "⚠ Undefined (math error)";
        return;
    }
    // Infinity usually means dividing by 0. Same snark as the basic calculator!
    if (!Number.isFinite(result.value)) {
        sciPreview.textContent = "⚠ " + SNARK[Math.floor(Math.random() * SNARK.length)];
        return;
    }

    const answer = formatResult(result.value);
    addToHistory(text, answer);

    lastAnswer = result.value;
    sciInput.value = answer;           // show the answer in the box
    sciPreview.textContent = text + " =";
    justAnswered = true;
}

function sciClear() {
    sciInput.value = "";
    sciPreview.textContent = "";
    justAnswered = false;
    sciInput.focus();
}

function sciBackspace() {
    if (justAnswered) {
        sciClear();
        return;
    }
    const start = sciInput.selectionStart;
    const end = sciInput.selectionEnd;

    if (start !== end) {
        // something is highlighted: delete the highlighted part
        sciInput.value = sciInput.value.slice(0, start) + sciInput.value.slice(end);
        sciInput.setSelectionRange(start, start);
    } else if (start > 0) {
        // delete one character before the cursor.
        // Bonus: delete whole function names at once, so "sin(" goes in one press
        const before = sciInput.value.slice(0, start);
        const match = before.match(/(asin|acos|atan|sin|cos|tan|ln|log|√|ans)\($|ans$/);
        const length = match ? match[0].length : 1;
        sciInput.value = before.slice(0, -length) + sciInput.value.slice(start);
        sciInput.setSelectionRange(start - length, start - length);
    }
    sciInput.focus();
    updatePreview();
}


// HISTORY: newest at the top, click to reuse the answer
function addToHistory(expressionText, answer) {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.className = "history-item";
    // two lines: the question (small) and the answer (big)
    button.innerHTML = `<span class="history-q"></span><span class="history-a"></span>`;
    // textContent (not innerHTML) for what YOU typed, so it's always treated as plain text
    button.querySelector(".history-q").textContent = expressionText + " =";
    button.querySelector(".history-a").textContent = answer;

    button.addEventListener("click", function () {
        insertText(answer);
    });

    item.appendChild(button);
    sciHistory.prepend(item);

    // keep only the 20 most recent
    while (sciHistory.children.length > 20) {
        sciHistory.lastElementChild.remove();
    }
}


// ----- CONNECT THE BUTTONS -----
document.querySelector(".sci-keys").addEventListener("click", function (event) {
    const button = event.target.closest("button");
    if (!button) return;

    if (button.dataset.insert !== undefined) {
        insertText(button.dataset.insert);
    } else if (button.dataset.sci === "equals") {
        sciEquals();
    } else if (button.dataset.sci === "clear") {
        sciClear();
    } else if (button.dataset.sci === "backspace") {
        sciBackspace();
    }
});

// DEG <-> RAD
angleButton.addEventListener("click", function () {
    useDegrees = !useDegrees;
    angleButton.textContent = useDegrees ? "DEG" : "RAD";
    updatePreview();
});

// TYPING in the box (keyboard)
sciInput.addEventListener("input", function () {
    justAnswered = false;
    updatePreview();
});

sciInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter" || event.key === "=") {
        event.preventDefault();   // don't type "=" into the box
        sciEquals();
    } else if (event.key === "Escape") {
        sciClear();
    } else if (justAnswered && event.key.length === 1) {
        // typing right after an answer: same rule as the buttons
        event.preventDefault();
        const symbols = { "*": "×", "/": "÷", "-": "−" };
        insertText(symbols[event.key] || event.key);
    }
});
