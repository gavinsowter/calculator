// =========================================================
// CALCULATOR
// No eval() anywhere: we do the math with our own functions.
// =========================================================


// =========================================================
// STEP 1: THE MATH FUNCTIONS
// (Try them in the console: add(3, 5) -> 8)
// =========================================================
function add(a, b) {
    return a + b;
}

function subtract(a, b) {
    return a - b;
}

function multiply(a, b) {
    return a * b;
}

function divide(a, b) {
    return a / b;
}


// =========================================================
// STEP 3: operate() picks the right math function
// operate("+", 3, 5) -> 8
// =========================================================
function operate(operator, a, b) {
    if (operator === "+") return add(a, b);
    if (operator === "-") return subtract(a, b);
    if (operator === "*") return multiply(a, b);
    if (operator === "/") return divide(a, b);
    return null;   // unknown operator (shouldn't happen)
}


// =========================================================
// STEP 2: THE THREE PARTS OF AN OPERATION
// For "12 + 7":  firstNumber = 12, operator = "+", and the
// second number is whatever is on the screen (currentInput).
// =========================================================
let firstNumber = null;      // the number before the operator
let operator = null;         // "+", "-", "*" or "/"
let currentInput = "0";      // what's on the screen right now (a STRING, so we can add digits to it)

// true right after you press an operator or "=".
// It means: "the next digit should START a new number, not add to this one".
let startNewNumber = false;

// true when the screen is showing an error (like divide by 0)
let showingError = false;

const MAX_DIGITS = 12;       // longest number you can type


// ----- GRAB THE PARTS OF THE PAGE -----
const screen        = document.querySelector("#screen");
const expression    = document.querySelector("#expression");
const decimalButton = document.querySelector("#decimal");
const operatorButtons = document.querySelectorAll("[data-operator]");

// the symbols to SHOW for each operator ("*" looks better as "×")
const SYMBOLS = { "+": "+", "-": "−", "*": "×", "/": "÷" };


// =========================================================
// UPDATING THE DISPLAY
// =========================================================
function updateDisplay() {
    screen.textContent = currentInput;

    // make long numbers use smaller text so they fit
    screen.classList.toggle("small", currentInput.length > 9);

    // top line: "12 +" while you're typing the second number
    if (operator !== null && firstNumber !== null) {
        expression.textContent = `${formatNumber(firstNumber)} ${SYMBOLS[operator]}`;
    } else {
        expression.textContent = "";
    }

    // EXTRA CREDIT: turn off "." if the number already has one
    // (and turn it back on when it doesn't)
    decimalButton.disabled = currentInput.includes(".") && !startNewNumber;

    // highlight the operator you picked, until you start typing the next number
    operatorButtons.forEach(function (button) {
        const isPicked = button.dataset.operator === operator && startNewNumber;
        button.classList.toggle("active", isPicked);
    });
}

// ROUNDING: turns a result into a short string that fits the screen.
// 0.1 + 0.2 = 0.30000000000000004 in JavaScript (a famous quirk!)
// so we round to 10 decimal places first.
function formatNumber(number) {
    // Math.round(x * 1e10) / 1e10 keeps 10 decimal places
    let rounded = Math.round(number * 1e10) / 1e10;
    let text = String(rounded);

    // still too long (like 123456789012345)? use scientific notation: 1.2346e+14
    if (text.length > MAX_DIGITS) {
        text = rounded.toExponential(4);
    }
    return text;
}

// Snarky messages for dividing by zero
const SNARK = ["Nice try. ÷0 🙃", "Can't divide by 0", "Error: math broke", "Nope. Not today."];


// =========================================================
// STEP 5: TYPING DIGITS
// =========================================================
function inputDigit(digit) {
    // after an error, typing starts fresh
    if (showingError) {
        clearAll();
    }

    if (startNewNumber) {
        // GOTCHA FIX: after an operator or a result, a new digit
        // REPLACES the screen instead of being added to the end
        currentInput = digit;
        startNewNumber = false;
    } else if (currentInput === "0") {
        currentInput = digit;          // replace the starting 0 (no "07")
    } else if (currentInput.replace("-", "").replace(".", "").length < MAX_DIGITS) {
        currentInput += digit;         // add the digit to the end
    }

    updateDisplay();
}

// EXTRA CREDIT: decimal point
function inputDecimal() {
    if (showingError) {
        clearAll();
    }

    if (startNewNumber) {
        currentInput = "0.";           // pressing "." first gives "0."
        startNewNumber = false;
    } else if (!currentInput.includes(".")) {
        currentInput += ".";           // only ONE decimal allowed (no 12.3.56)
    }

    updateDisplay();
}


// =========================================================
// STEP 6: OPERATORS AND EQUALS (the hardest part!)
// =========================================================
function inputOperator(nextOperator) {
    if (showingError) {
        return;                        // can't do math on an error message
    }

    // GOTCHA FIX: pressing two operators in a row ("2 + +" or "2 + -")
    // should NOT calculate anything. Just swap to the newest operator.
    if (operator !== null && startNewNumber) {
        operator = nextOperator;
        updateDisplay();
        return;
    }

    if (firstNumber === null) {
        // first operator: save what's on the screen as the first number
        firstNumber = Number(currentInput);
    } else {
        // GOTCHA FIX: "12 + 7 -" should calculate 12 + 7 = 19 FIRST,
        // then use 19 as the first number of the next operation.
        const result = calculate();
        if (result === null) return;   // it was an error (divide by 0)
        firstNumber = result;
        currentInput = formatNumber(result);
    }

    operator = nextOperator;
    startNewNumber = true;
    updateDisplay();
}

function inputEquals() {
    // GOTCHA FIX: pressing "=" without a full operation
    // (like "5 =" or "5 + =") does nothing instead of breaking
    if (operator === null || startNewNumber || showingError) {
        return;
    }

    const shownExpression = `${formatNumber(firstNumber)} ${SYMBOLS[operator]} ${currentInput} =`;

    const result = calculate();
    if (result === null) return;       // error, already handled

    currentInput = formatNumber(result);
    firstNumber = null;                // the operation is finished
    operator = null;
    startNewNumber = true;             // next digit starts a brand-new calculation

    updateDisplay();
    expression.textContent = shownExpression;   // show what was just solved, like "12 + 7 ="
}

// does firstNumber (operator) currentInput, and handles divide by 0.
// Returns the answer, or null if there was an error.
function calculate() {
    const secondNumber = Number(currentInput);

    // GOTCHA FIX: divide by 0 shows a snarky message and resets,
    // instead of showing "Infinity" or crashing
    if (operator === "/" && secondNumber === 0) {
        showError(SNARK[Math.floor(Math.random() * SNARK.length)]);
        return null;
    }

    return operate(operator, firstNumber, secondNumber);
}

function showError(message) {
    firstNumber = null;
    operator = null;
    currentInput = "0";
    startNewNumber = true;
    showingError = true;

    updateDisplay();
    screen.textContent = message;
    screen.classList.add("small");
}


// =========================================================
// CLEAR, BACKSPACE, PERCENT
// =========================================================

// GOTCHA FIX: "clear" wipes EVERYTHING, so you really start fresh
function clearAll() {
    firstNumber = null;
    operator = null;
    currentInput = "0";
    startNewNumber = false;
    showingError = false;
    updateDisplay();
}

// EXTRA CREDIT: backspace removes the last thing you typed
function backspace() {
    if (showingError) {
        clearAll();
        return;
    }
    // don't backspace a finished answer, only a number you're typing
    if (startNewNumber) {
        return;
    }

    currentInput = currentInput.slice(0, -1);   // slice(0, -1) = everything except the last character

    // nothing left (or just a "-")? go back to 0
    if (currentInput === "" || currentInput === "-") {
        currentInput = "0";
    }
    updateDisplay();
}

// bonus: % turns 50 into 0.5
function percent() {
    if (showingError) return;
    currentInput = formatNumber(Number(currentInput) / 100);
    updateDisplay();
}


// =========================================================
// CONNECT THE ON-SCREEN BUTTONS
// One listener on the whole keypad ("event delegation", same
// trick as the Etch-A-Sketch) instead of one per button.
// =========================================================
document.querySelector(".keys").addEventListener("click", function (event) {
    // closest() finds the button that was clicked, even if you clicked its text
    const button = event.target.closest("button");
    if (!button) return;

    if (button.dataset.digit !== undefined) {
        inputDigit(button.dataset.digit);
    } else if (button.dataset.operator) {
        inputOperator(button.dataset.operator);
    } else if (button.dataset.action === "decimal") {
        inputDecimal();
    } else if (button.dataset.action === "equals") {
        inputEquals();
    } else if (button.dataset.action === "clear") {
        clearAll();
    } else if (button.dataset.action === "backspace") {
        backspace();
    } else if (button.dataset.action === "percent") {
        percent();
    }
});


// =========================================================
// EXTRA CREDIT: KEYBOARD SUPPORT
// "keydown" fires every time a key is pressed.
// event.key tells us which key ("7", "+", "Enter", ...)
// =========================================================
document.addEventListener("keydown", function (event) {
    // Only react when the Basic calculator is showing, and not while
    // you're typing in a text box (Scientific/Graph modes have their own typing).
    if (document.querySelector("#basic-panel").hidden || event.target.tagName === "INPUT") {
        return;
    }

    const key = event.key;
    let selector = null;   // which on-screen button to "flash", so you see the press

    if (key >= "0" && key <= "9") {
        inputDigit(key);
        selector = `[data-digit="${key}"]`;
    } else if (key === "." || key === ",") {
        inputDecimal();
        selector = "#decimal";
    } else if (key === "+" || key === "-" || key === "*" || key === "/") {
        event.preventDefault();   // stops "/" from opening the browser's quick-find
        inputOperator(key);
        selector = `[data-operator="${key}"]`;
    } else if (key === "x" || key === "X") {
        inputOperator("*");       // let people type x for multiply too
        selector = '[data-operator="*"]';
    } else if (key === "Enter" || key === "=") {
        event.preventDefault();   // stops Enter from also "clicking" a focused button
        inputEquals();
        selector = '[data-action="equals"]';
    } else if (key === "Backspace") {
        backspace();
        selector = '[data-action="backspace"]';
    } else if (key === "Escape" || key === "Delete" || key === "c" || key === "C") {
        clearAll();
        selector = '[data-action="clear"]';
    } else if (key === "%") {
        percent();
        selector = '[data-action="percent"]';
    }

    // briefly "press" the matching on-screen button
    if (selector) {
        const button = document.querySelector(selector);
        button.classList.add("pressed");
        setTimeout(function () { button.classList.remove("pressed"); }, 100);
    }
});


// show the starting 0
updateDisplay();
