// =========================================================
// PARSER: turns text like "2sin(30) + 3^2" into an answer,
// WITHOUT eval(). Used by both the Scientific and Graph modes.
//
// It works in 3 steps, like reading a sentence:
//   1. TOKENIZE: split the text into pieces ("tokens"):
//        "2sin(30)" -> [2] [sin] [(] [30] [)]
//   2. PARSE: arrange the tokens into a TREE that respects
//      order of operations (PEMDAS):
//        2 + 3 * 4  ->      +
//                          / \
//                         2   *
//                            / \
//                           3   4
//   3. EVALUATE: work out the tree from the bottom up.
//
// The parse step uses a technique called "recursive descent":
// one function per level of PEMDAS, and each level calls the
// next tighter level. Lowest priority (+ -) is checked first,
// highest priority (numbers, parentheses) last.
// =========================================================


// ----- CONSTANTS you can type -----
const CONSTANTS = {
    pi: Math.PI,
    "π": Math.PI,
    e: Math.E,
};

// ----- FUNCTIONS you can type -----
// "trig: true" means the function cares about degrees vs radians.
// Each one is a small function that takes numbers and returns a number.
const FUNCTIONS = {
    sin:   { trig: "in",  fn: Math.sin },
    cos:   { trig: "in",  fn: Math.cos },
    tan:   { trig: "in",  fn: Math.tan },
    asin:  { trig: "out", fn: Math.asin },
    acos:  { trig: "out", fn: Math.acos },
    atan:  { trig: "out", fn: Math.atan },
    sinh:  { fn: Math.sinh },
    cosh:  { fn: Math.cosh },
    tanh:  { fn: Math.tanh },
    sqrt:  { fn: Math.sqrt },
    cbrt:  { fn: Math.cbrt },
    abs:   { fn: Math.abs },
    ln:    { fn: Math.log },              // natural log (base e)
    log:   { fn: Math.log10 },            // log base 10
    exp:   { fn: Math.exp },
    floor: { fn: Math.floor },
    ceil:  { fn: Math.ceil },
    round: { fn: Math.round },
};

// every word the calculator understands, LONGEST first.
// (So "asin" is matched before "sin", and "sinh" before "sin".)
const WORDS = [...Object.keys(FUNCTIONS), "pi", "ans", "e", "x"]
    .sort(function (a, b) { return b.length - a.length; });


// =========================================================
// STEP 1: TOKENIZE
// =========================================================
function tokenize(text) {
    // swap "pretty" symbols for the plain ones we parse
    text = text
        .replace(/×/g, "*")
        .replace(/÷/g, "/")
        .replace(/−/g, "-")
        .replace(/²/g, "^2")
        .replace(/³/g, "^3")
        .replace(/√/g, "sqrt")
        .toLowerCase();

    const tokens = [];
    let i = 0;

    while (i < text.length) {
        const ch = text[i];

        // skip spaces
        if (ch === " ") {
            i++;
            continue;
        }

        // NUMBERS: like 12, 3.5, .5, or 2e5 (= 2 × 10^5)
        // A "regular expression" (regex) is a pattern for matching text.
        // This one means: digits with an optional decimal, then an optional e+digits.
        const numberMatch = text.slice(i).match(/^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/);
        if (numberMatch) {
            tokens.push({ type: "number", value: parseFloat(numberMatch[0]) });
            i += numberMatch[0].length;
            continue;
        }

        // WORDS: like sin, pi, x. "2pix" or "sinx" have no spaces,
        // so we peel off known words one at a time.
        if (/[a-zπ]/.test(ch)) {
            const word = WORDS.find(function (w) { return text.startsWith(w, i); })
                || (ch === "π" ? "π" : null);
            if (!word) {
                throw new Error(`Unknown: "${text.slice(i).match(/^[a-z]+/)[0]}"`);
            }
            if (FUNCTIONS[word]) {
                tokens.push({ type: "function", value: word });
            } else if (word === "x") {
                tokens.push({ type: "variable", value: "x" });
            } else if (word === "ans") {
                tokens.push({ type: "variable", value: "ans" });
            } else {
                tokens.push({ type: "number", value: CONSTANTS[word] });
            }
            i += word.length;
            continue;
        }

        // OPERATORS and PUNCTUATION
        if ("+-*/^()!%,".includes(ch)) {
            tokens.push({ type: "op", value: ch });
            i++;
            continue;
        }

        throw new Error(`Unexpected "${ch}"`);
    }

    return tokens;
}


// =========================================================
// STEP 2: PARSE (build the tree)
// Each tree "node" is an object like:
//   { type: "num", value: 3 }
//   { type: "var", name: "x" }
//   { type: "binary", op: "+", left: <node>, right: <node> }
//   { type: "unary", op: "-", arg: <node> }
//   { type: "call", name: "sin", args: [<node>] }
// =========================================================
function parse(text) {
    const tokens = tokenize(text);
    let pos = 0;   // which token we're looking at

    // helpers to look at / use up tokens
    const peek = function () { return tokens[pos]; };
    const next = function () { return tokens[pos++]; };
    const isOp = function (value) {
        const t = peek();
        return t && t.type === "op" && t.value === value;
    };

    // can the next token START a new factor? (for implicit multiplication: 2x, 3(4), 2sin(x))
    const startsFactor = function () {
        const t = peek();
        if (!t) return false;
        return t.type === "number" || t.type === "variable" || t.type === "function" || (t.type === "op" && t.value === "(");
    };

    // LEVEL 1 (lowest priority): + and -
    function parseExpression() {
        let node = parseTerm();
        while (isOp("+") || isOp("-")) {
            const op = next().value;
            node = { type: "binary", op: op, left: node, right: parseTerm() };
        }
        return node;
    }

    // LEVEL 2: * and /, plus "implicit" multiplication like 2x or 3(1+2)
    function parseTerm() {
        let node = parseUnary();
        while (true) {
            if (isOp("*") || isOp("/")) {
                const op = next().value;
                node = { type: "binary", op: op, left: node, right: parseUnary() };
            } else if (startsFactor()) {
                node = { type: "binary", op: "*", left: node, right: parseUnary() };
            } else {
                break;
            }
        }
        return node;
    }

    // LEVEL 3: negative signs, like -5 or -(2+3)
    function parseUnary() {
        if (isOp("-")) {
            next();
            return { type: "unary", op: "-", arg: parseUnary() };
        }
        if (isOp("+")) {
            next();
            return parseUnary();
        }
        return parsePower();
    }

    // LEVEL 4: powers, like 2^3. "Right associative": 2^3^2 = 2^(3^2)
    // Note -2^2 = -4 (power happens before the minus), like real math.
    function parsePower() {
        const base = parsePostfix();
        if (isOp("^")) {
            next();
            return { type: "binary", op: "^", left: base, right: parseUnary() };
        }
        return base;
    }

    // LEVEL 5: things AFTER a number: factorial (5!) and percent (50%)
    function parsePostfix() {
        let node = parsePrimary();
        while (isOp("!") || isOp("%")) {
            const op = next().value;
            node = { type: "postfix", op: op, arg: node };
        }
        return node;
    }

    // LEVEL 6 (highest priority): numbers, x, functions, parentheses
    function parsePrimary() {
        const t = next();

        if (!t) {
            throw new Error("Incomplete expression");
        }
        if (t.type === "number") {
            return { type: "num", value: t.value };
        }
        if (t.type === "variable") {
            return { type: "var", name: t.value };
        }
        if (t.type === "function") {
            // sin(30) -> with parentheses
            if (isOp("(")) {
                next();
                const args = [parseExpression()];
                while (isOp(",")) {          // for 2-input functions (not used yet, but supported)
                    next();
                    args.push(parseExpression());
                }
                closeParen();
                return { type: "call", name: t.value, args: args };
            }
            // sin x or sin 30 -> without parentheses
            return { type: "call", name: t.value, args: [parsePower()] };
        }
        if (t.type === "op" && t.value === "(") {
            const inside = parseExpression();
            closeParen();
            return inside;
        }

        throw new Error(`Unexpected "${t.value}"`);
    }

    // forgive a missing ")" at the very end, like most calculators do: "sin(30" works
    function closeParen() {
        if (isOp(")")) {
            next();
        } else if (pos < tokens.length) {
            throw new Error('Missing ")"');
        }
    }

    if (tokens.length === 0) {
        throw new Error("Empty");
    }

    const tree = parseExpression();

    // leftover tokens = something didn't make sense, like "3 4 )"
    if (pos < tokens.length) {
        throw new Error(`Unexpected "${peek().value}"`);
    }
    return tree;
}


// =========================================================
// STEP 3: EVALUATE
// compile() turns the tree into a JavaScript function ONCE.
// The graph calls that function hundreds of times per frame,
// so this is much faster than re-reading the text every time.
// =========================================================

// factorial: 5! = 5 × 4 × 3 × 2 × 1 = 120
function factorial(n) {
    if (n < 0 || !Number.isInteger(n)) return NaN;   // only whole numbers
    if (n > 170) return Infinity;                     // too big for JavaScript
    let result = 1;
    for (let i = 2; i <= n; i++) result *= i;
    return result;
}

// options.degrees: true = trig uses degrees, false = radians
function compile(tree, options) {
    const degrees = options && options.degrees;
    const toRad = degrees ? Math.PI / 180 : 1;     // multiply degrees by this to get radians

    function build(node) {
        if (node.type === "num") {
            const v = node.value;
            return function () { return v; };
        }
        if (node.type === "var") {
            const name = node.name;
            return function (scope) { return scope[name]; };
        }
        if (node.type === "unary") {
            const arg = build(node.arg);
            return function (scope) { return -arg(scope); };
        }
        if (node.type === "postfix") {
            const arg = build(node.arg);
            if (node.op === "!") return function (scope) { return factorial(arg(scope)); };
            return function (scope) { return arg(scope) / 100; };   // percent
        }
        if (node.type === "binary") {
            const left = build(node.left);
            const right = build(node.right);
            // these are YOUR add/subtract/multiply/divide ideas, just written inline
            switch (node.op) {
                case "+": return function (s) { return left(s) + right(s); };
                case "-": return function (s) { return left(s) - right(s); };
                case "*": return function (s) { return left(s) * right(s); };
                case "/": return function (s) { return left(s) / right(s); };
                case "^": return function (s) { return Math.pow(left(s), right(s)); };
            }
        }
        if (node.type === "call") {
            const info = FUNCTIONS[node.name];
            const args = node.args.map(build);
            const arg = args[0];

            if (info.trig === "in") {
                // sin, cos, tan: convert the INPUT to radians first
                return function (s) {
                    const input = arg(s);
                    // tan(90°) is undefined (the graph shoots off to infinity)
                    if (node.name === "tan" && degrees && Math.abs(((input % 180) + 180) % 180 - 90) < 1e-9) {
                        return NaN;
                    }
                    const result = info.fn(input * toRad);
                    // tidy up tiny errors: sin(180°) should be 0, not 1.2e-16
                    return Math.abs(result) < 1e-14 ? 0 : result;
                };
            }
            if (info.trig === "out") {
                // asin, acos, atan: convert the OUTPUT back to degrees
                return function (s) { return info.fn(arg(s)) / toRad; };
            }
            return function (s) { return info.fn(...args.map(function (a) { return a(s); })); };
        }
        throw new Error("Can't evaluate");
    }

    return build(tree);
}

// One-step helper: text in, number out. evaluate("2+2") -> 4
function evaluate(text, scope, options) {
    return compile(parse(text), options)(scope || {});
}

// Nice short text for a result: 12 significant digits, scientific notation when huge or tiny
function formatResult(value) {
    if (Number.isNaN(value)) return "Undefined";
    if (!Number.isFinite(value)) return value > 0 ? "∞" : "-∞";

    const tidy = Number(value.toPrecision(12));   // removes 0.30000000000000004-style noise
    const abs = Math.abs(tidy);
    if (abs !== 0 && (abs >= 1e12 || abs < 1e-6)) {
        return tidy.toExponential(6).replace(/\.?0+e/, "e");   // 1.5e+20 instead of 1.500000e+20
    }
    return String(tidy);
}
