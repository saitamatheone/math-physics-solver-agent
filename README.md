# 🧮 Multi-Step Math & Physics Solver Agent

> A Chrome Extension powered by **Gemini 3.1 Flash Lite** that reasons through math and physics problems step-by-step using an agentic loop.

---

## 📁 Project Structure

```
EAVGV3 assignment 5/
├── manifest.json       # Chrome Extension MV3 config
├── background.js       # Agentic loop (service worker)
├── popup.html          # Extension UI
├── popup.js            # UI controller & reasoning chain renderer
├── tools.js            # Tool implementations: calculate, convert, lookup
├── icons/              # Extension icons (16px, 48px, 128px)
└── .env                # API key reference (GEMINI_API_KEY)
```

---

## 🧠 The System Prompt

The agent is driven by a structured system prompt injected into every Gemini call via `background.js`. The prompt enforces a **5-step reasoning loop**:

```
STEP 1 — UNDERSTAND   → identify the problem, tag reasoning type
STEP 2 — PLAN         → break into sub-problems, flag tool needs
STEP 3 — SOLVE        → issue FUNCTION_CALLs, reason between results
STEP 4 — VERIFY       → check units, sanity-check magnitude
STEP 5 — ANSWER       → emit structured JSON (see below)
```

---

## ✅ Where the Prompt Qualifies the Test Output

**The test output format is defined in STEP 5 of the system prompt**, inside `background.js` (lines 35–44):

```
STEP 5 — ANSWER
Respond ONLY in this JSON format (no extra text after):
{
  "problem_type": "[tag from step 1]",
  "steps": ["step 1 description", "step 2 description"],
  "tool_calls_made": ["calculate", "convert"],
  "final_answer": "<value with units>",
  "confidence": "high | medium | low",
  "assumptions": ["list any assumptions made"]
}
```

This JSON block is the **machine-readable test output** that `background.js` parses via `extractFinalAnswer()` to detect loop completion and deliver the result to the popup. Every field is validated and rendered individually in the Final Answer panel of the UI.

### Output Field Breakdown

| Field | Type | Purpose |
|-------|------|---------|
| `problem_type` | `string` | Reasoning tag from STEP 1 — e.g. `[PHYSICS]`, `[ALGEBRA]` |
| `steps` | `string[]` | Human-readable summary of each reasoning step taken |
| `tool_calls_made` | `string[]` | Which tools were invoked: `calculate`, `convert`, `lookup` |
| `final_answer` | `string` | The computed result with units — e.g. `"4.04 seconds"` |
| `confidence` | `"high" \| "medium" \| "low"` | Model's self-assessed certainty |
| `assumptions` | `string[]` | Any assumptions made (e.g. "no air resistance") |

---

## ⚙️ Agentic Loop Architecture

```
User types problem
       ↓
popup.js  →  chrome.runtime.sendMessage(SOLVE_PROBLEM)
       ↓
background.js  →  Gemini 3.1 Flash Lite (with system prompt)
       ↓
   Parse FUNCTION_CALL lines from model response
       ↓
   Dispatch to tools.js  →  calculate / convert / lookup
       ↓
   Feed TOOL_RESULT back into Gemini as next turn
       ↓
   Repeat until STEP 5 JSON is detected
       ↓
popup.js  ←  chrome.runtime.sendMessage({ type: 'final', answer })
       ↓
Render Final Answer panel
```

---

## 🔧 Three Tool Functions (`tools.js`)

### 1. `calculate(expression)`
Safely evaluates math expressions using a sandboxed `Function` constructor.
- Supports: `^`, `×`, `÷`, `π`, `sqrt()`, `sin()`, `cos()`, `tan()`, `log()`, `ln()`, `abs()`
- Example: `FUNCTION_CALL: calculate | expression: "0.5 * 1200 * 26.82**2"`

### 2. `convert(from, to)`
Converts between 30+ unit pairs across length, mass, time, temperature, speed, energy, pressure, force, and angles.
- Example: `FUNCTION_CALL: convert | from: "60 mph" | to: "m/s"`

### 3. `lookup(fact)`
Returns physical constants and formulas from a built-in knowledge base (50+ entries).
- Example: `FUNCTION_CALL: lookup | fact: "kinetic energy"`
- Returns: `KE = ½mv²`

---

## ⚠️ Error Handling

API errors (including `429 Too Many Requests`) are surfaced immediately as raw error messages in the popup — no retries. If you hit a quota limit, wait for it to reset or use a different API key.

---

## 🚀 Installation

1. Clone / download the project folder
2. Open Chrome → `chrome://extensions`
3. Enable **Developer mode** (top right toggle)
4. Click **Load unpacked** → select the `EAVGV3 assignment 5` folder
5. Click the extension icon 🧮 in the toolbar

---

## 🧪 Example Test Run

**Input:**
```
A ball is dropped from 80 meters. How long does it take to hit the ground?
What is its velocity just before impact?
```

**Expected Output (STEP 5 JSON):**
```json
{
  "problem_type": "[PHYSICS]",
  "steps": [
    "Identified free-fall problem with h=80m, g=9.8 m/s²",
    "Used kinematic equation: h = ½gt² → t = √(2h/g)",
    "Calculated t = √(2×80/9.8) = √16.33 ≈ 4.04 s",
    "Calculated final velocity: v = gt = 9.8 × 4.04 ≈ 39.6 m/s",
    "Verified units: meters and seconds consistent throughout"
  ],
  "tool_calls_made": ["lookup", "calculate", "calculate"],
  "final_answer": "t ≈ 4.04 s, v ≈ 39.6 m/s",
  "confidence": "high",
  "assumptions": ["No air resistance", "Standard gravity g = 9.8 m/s²"]
}
```

---

## 📋 Prompt Design Checklist

| Criterion | Status | Where in Prompt |
|-----------|--------|-----------------|
| Explicit step-by-step reasoning | ✅ | STEP 1–5 structure |
| Structured output format | ✅ | **STEP 5 JSON block** |
| Tool separation | ✅ | `FUNCTION_CALL:` syntax in STEP 3 |
| Multi-turn loop support | ✅ | "wait for result, then reason" rule |
| Instructional framing | ✅ | `RULES:` section |
| Self-verification | ✅ | STEP 4 — VERIFY with `⚠️ RECHECK` |
| Reasoning type tagging | ✅ | `[ARITHMETIC]` `[PHYSICS]` etc. in STEP 1 |
| Error / fallback handling | ✅ | `⚠️ FALLBACK:` rule |

---

## 🔑 API Key

API key is sourced from `.env` (`GEMINI_API_KEY`) and hardcoded into `background.js` at build time, since Chrome extensions cannot read environment variables at runtime.
