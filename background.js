// background.js — Agentic loop service worker for Math & Physics Solver

importScripts('tools.js');

const GEMINI_API_KEY = 'AIzaSyC0_exacRQvoesvsei2gC4lkQoxC0clNOw'; // sourced from .env
const GEMINI_MODEL = 'gemini-3.1-flash-lite'; // confirmed available on this API key
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

const SYSTEM_PROMPT = `You are a Multi-Step Math and Physics Solver Agent.

When given a problem, you MUST follow this exact reasoning loop:

STEP 1 — UNDERSTAND
- Identify what is being asked
- List all given values with units
- Tag the reasoning type: [ARITHMETIC] [ALGEBRA] [GEOMETRY] [PHYSICS] [CALCULUS] [LOGIC]

STEP 2 — PLAN
- Break the problem into numbered sub-problems
- Identify which sub-problems need tool use (CALCULATE, LOOKUP, CONVERT)

STEP 3 — SOLVE (repeat per sub-problem)
For each sub-problem, respond in this exact format:

FUNCTION_CALL: calculate | expression: "<math expression>"
FUNCTION_CALL: convert | from: "<value unit>" | to: "<target unit>"
FUNCTION_CALL: lookup | fact: "<constant or formula name>"

After each FUNCTION_CALL, wait for the result, then reason about it before proceeding.

STEP 4 — VERIFY
- Re-check units match
- Sanity check: does the magnitude make sense?
- If something seems off, flag it as: ⚠️ RECHECK: <reason>

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

RULES:
- Never skip steps
- Never combine SOLVE and VERIFY
- If you are unsure about a formula, use FUNCTION_CALL: lookup before proceeding
- If a tool fails or returns unexpected output, respond with:
  ⚠️ FALLBACK: <describe what you tried and what you will do instead>
- Always show reasoning between tool calls, never chain them silently
- When you issue a FUNCTION_CALL, stop and wait — do NOT continue until the result is given back to you`;

/**
 * Parses FUNCTION_CALL lines from model text
 * Returns array of { tool, args } objects
 */
function parseFunctionCalls(text) {
  const calls = [];
  const lines = text.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('FUNCTION_CALL:')) continue;

    // Remove prefix
    const rest = trimmed.replace(/^FUNCTION_CALL:\s*/, '');

    // Split on |
    const parts = rest.split('|').map(p => p.trim());
    const tool = parts[0].trim().toLowerCase();

    const args = {};
    for (let i = 1; i < parts.length; i++) {
      const kv = parts[i].split(':');
      if (kv.length >= 2) {
        const key = kv[0].trim();
        const val = kv.slice(1).join(':').trim().replace(/^"|"$/g, '');
        args[key] = val;
      }
    }

    calls.push({ tool, args });
  }

  return calls;
}

/**
 * Dispatches a tool call and returns a formatted result string
 */
function dispatchTool(toolCall) {
  const { tool, args } = toolCall;

  try {
    if (tool === 'calculate') {
      const result = calculate(args.expression);
      if (result.error) return `TOOL_RESULT [calculate]: ERROR — ${result.error}`;
      return `TOOL_RESULT [calculate]: ${args.expression} = ${result.result}`;
    }

    if (tool === 'convert') {
      const result = convert(args.from, args.to);
      if (result.error) return `TOOL_RESULT [convert]: ERROR — ${result.error}`;
      return `TOOL_RESULT [convert]: ${result.from} = ${result.result} ${result.to}`;
    }

    if (tool === 'lookup') {
      const result = lookup(args.fact);
      if (!result.found) return `TOOL_RESULT [lookup]: NOT FOUND — ${result.error}`;
      const detail = result.formula || result.value || JSON.stringify(result.formulas || '');
      const notes = result.notes ? ` | Notes: ${result.notes}` : '';
      return `TOOL_RESULT [lookup]: "${result.fact}" → ${detail}${notes}`;
    }

    return `TOOL_RESULT [${tool}]: ERROR — Unknown tool`;
  } catch (err) {
    return `TOOL_RESULT [${tool}]: ERROR — ${err.message}`;
  }
}

/**
 * Calls Gemini API with conversation history
 * Throws the raw API error on failure
 */
async function callGemini(conversationHistory) {
  const body = {
    system_instruction: {
      parts: [{ text: SYSTEM_PROMPT }]
    },
    contents: conversationHistory
  };

  const response = await fetch(GEMINI_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty response from Gemini API');
  return text;
}

/**
 * Extracts the final JSON answer block from model response
 */
function extractFinalAnswer(text) {
  try {
    const jsonMatch = text.match(/\{[\s\S]*"final_answer"[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch (_) {}
  return null;
}

/**
 * Main agentic loop
 * Sends steps back to popup progressively via sendResponse chunks (chrome.runtime)
 */
async function runAgentLoop(problem, sendUpdate) {
  const conversationHistory = [
    { role: 'user', parts: [{ text: `Problem: ${problem}` }] }
  ];

  const MAX_TURNS = 12;
  let turn = 0;
  const toolCallsLog = [];

  sendUpdate({ type: 'status', text: '🤔 Starting reasoning loop...' });

  while (turn < MAX_TURNS) {
    turn++;
    sendUpdate({ type: 'status', text: `🔄 Turn ${turn}: Calling Gemini...` });

    let modelText;
    try {
      modelText = await callGemini(conversationHistory);
    } catch (err) {
      sendUpdate({ type: 'error', text: `❌ API Error: ${err.message}` });
      return;
    }

    // Add model response to history
    conversationHistory.push({ role: 'model', parts: [{ text: modelText }] });

    // Stream the reasoning text to popup
    sendUpdate({ type: 'reasoning', text: modelText });

    // Check if we've reached STEP 5 — final answer
    const finalAnswer = extractFinalAnswer(modelText);
    if (finalAnswer) {
      finalAnswer.tool_calls_made = [...new Set(toolCallsLog)];
      sendUpdate({ type: 'final', answer: finalAnswer });
      return;
    }

    // Parse any FUNCTION_CALLs
    const calls = parseFunctionCalls(modelText);

    if (calls.length === 0) {
      // No function calls and no final answer — ask model to continue
      conversationHistory.push({
        role: 'user',
        parts: [{ text: 'Please continue to the next step.' }]
      });
      continue;
    }

    // Execute each tool call and build result message
    const toolResults = [];
    for (const call of calls) {
      sendUpdate({ type: 'tool', tool: call.tool, args: call.args });
      const result = dispatchTool(call);
      toolResults.push(result);
      toolCallsLog.push(call.tool);
      sendUpdate({ type: 'tool_result', text: result });
    }

    // Feed results back to Gemini
    const feedbackMsg = toolResults.join('\n\n') + '\n\nPlease continue reasoning based on these results.';
    conversationHistory.push({
      role: 'user',
      parts: [{ text: feedbackMsg }]
    });
  }

  sendUpdate({ type: 'error', text: '⚠️ Maximum turns reached without a final answer. The problem may be too complex.' });
}

// Listen for messages from popup.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SOLVE_PROBLEM') {
    const { problem, tabId } = message;

    // We use a streaming approach via repeated messages to the tab/popup
    // Since sendResponse can only be called once, we use chrome.runtime.sendMessage back
    runAgentLoop(problem, (update) => {
      chrome.runtime.sendMessage({ ...update, source: 'agent' }).catch(() => {});
    });

    // Acknowledge immediately
    sendResponse({ status: 'started' });
    return true; // Keep channel open
  }
});
