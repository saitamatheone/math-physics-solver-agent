// popup.js — Handles UI interaction, sends problems to background, renders reasoning chain

document.addEventListener('DOMContentLoaded', () => {
  const solveBtn = document.getElementById('solve-btn');
  const problemInput = document.getElementById('problem-input');
  const clearBtn = document.getElementById('clear-btn');
  const reasoningChain = document.getElementById('reasoning-chain');
  const finalAnswerSection = document.getElementById('final-answer-section');
  const statusBar = document.getElementById('status-bar');
  const charCount = document.getElementById('char-count');
  const copyBtn = document.getElementById('copy-btn');
  const exampleBtns = document.querySelectorAll('.example-btn');

  let isRunning = false;
  let fullReasoningText = '';

  // ─── Character count ─────────────────────────────────────────────
  problemInput.addEventListener('input', () => {
    const len = problemInput.value.length;
    charCount.textContent = `${len}/500`;
    charCount.style.color = len > 450 ? '#ff6b6b' : '#888';
  });

  // ─── Example buttons ──────────────────────────────────────────────
  exampleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      problemInput.value = btn.dataset.problem;
      charCount.textContent = `${btn.dataset.problem.length}/500`;
      problemInput.focus();
    });
  });

  // ─── Clear button ─────────────────────────────────────────────────
  clearBtn.addEventListener('click', () => {
    problemInput.value = '';
    charCount.textContent = '0/500';
    reasoningChain.innerHTML = getPlaceholderHTML();
    finalAnswerSection.style.display = 'none';
    fullReasoningText = '';
    setStatus('', false);
    solveBtn.disabled = false;
    isRunning = false;
  });

  // ─── Copy reasoning button ────────────────────────────────────────
  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(fullReasoningText).then(() => {
      copyBtn.textContent = '✅ Copied!';
      setTimeout(() => { copyBtn.textContent = '📋 Copy Log'; }, 2000);
    });
  });

  // ─── Solve button ─────────────────────────────────────────────────
  solveBtn.addEventListener('click', () => {
    if (isRunning) return;
    const problem = problemInput.value.trim();
    if (!problem) {
      showError('Please enter a problem first.');
      return;
    }

    startSolving(problem);
  });

  // Also allow Ctrl+Enter / Cmd+Enter to submit
  problemInput.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      solveBtn.click();
    }
  });

  // ─── Listen for agent updates from background ─────────────────────
  chrome.runtime.onMessage.addListener((message) => {
    if (message.source !== 'agent') return;
    handleAgentUpdate(message);
  });

  // ─── Core Functions ───────────────────────────────────────────────

  function startSolving(problem) {
    isRunning = true;
    fullReasoningText = '';
    solveBtn.disabled = true;
    solveBtn.innerHTML = '<span class="spinner"></span> Thinking...';
    finalAnswerSection.style.display = 'none';

    // Clear and show live chain
    reasoningChain.innerHTML = '';
    appendBlock('problem-block', `📌 Problem\n${problem}`);

    setStatus('🤖 Agent is reasoning...', true);

    chrome.runtime.sendMessage(
      { type: 'SOLVE_PROBLEM', problem },
      (response) => {
        if (chrome.runtime.lastError) {
          showError('Could not reach background. Try reloading the extension.');
          resetBtn();
        }
      }
    );
  }

  function handleAgentUpdate(msg) {
    switch (msg.type) {
      case 'status':
        setStatus(msg.text, true);
        appendBlock('status-block', msg.text);
        fullReasoningText += msg.text + '\n';
        break;

      case 'reasoning':
        appendReasoningBlock(msg.text);
        fullReasoningText += msg.text + '\n\n';
        break;

      case 'tool':
        appendToolCallBlock(msg.tool, msg.args);
        fullReasoningText += `[TOOL] ${msg.tool}: ${JSON.stringify(msg.args)}\n`;
        break;

      case 'tool_result':
        appendToolResultBlock(msg.text);
        fullReasoningText += msg.text + '\n';
        break;

      case 'final':
        setStatus('✅ Done!', false);
        renderFinalAnswer(msg.answer);
        resetBtn();
        isRunning = false;
        copyBtn.style.display = 'inline-flex';
        break;

      case 'error':
        showError(msg.text);
        resetBtn();
        isRunning = false;
        break;
    }

    // Auto-scroll reasoning chain
    reasoningChain.scrollTop = reasoningChain.scrollHeight;
  }

  function appendBlock(className, text) {
    const div = document.createElement('div');
    div.className = `chain-block ${className}`;
    div.textContent = text;
    reasoningChain.appendChild(div);
    reasoningChain.scrollTop = reasoningChain.scrollHeight;
  }

  function appendReasoningBlock(text) {
    // Colorize STEP headers, FUNCTION_CALLs, ⚠️, etc.
    const div = document.createElement('div');
    div.className = 'chain-block reasoning-block';
    div.innerHTML = formatReasoningText(text);
    reasoningChain.appendChild(div);
    reasoningChain.scrollTop = reasoningChain.scrollHeight;
  }

  function appendToolCallBlock(tool, args) {
    const div = document.createElement('div');
    div.className = 'chain-block tool-call-block';
    const argsStr = Object.entries(args).map(([k, v]) => `${k}: "${v}"`).join(' | ');
    div.innerHTML = `<span class="tool-label">🔧 TOOL CALL</span> <span class="tool-name">${tool.toUpperCase()}</span><br><span class="tool-args">${argsStr}</span>`;
    reasoningChain.appendChild(div);
    reasoningChain.scrollTop = reasoningChain.scrollHeight;
  }

  function appendToolResultBlock(text) {
    const div = document.createElement('div');
    div.className = 'chain-block tool-result-block';
    const isError = text.includes('ERROR');
    div.innerHTML = `<span class="result-label">${isError ? '❌ RESULT' : '✅ RESULT'}</span><br>${escapeHtml(text)}`;
    reasoningChain.appendChild(div);
    reasoningChain.scrollTop = reasoningChain.scrollHeight;
  }

  function renderFinalAnswer(answer) {
    finalAnswerSection.style.display = 'block';

    document.getElementById('answer-value').textContent = answer.final_answer || '—';
    document.getElementById('answer-type').textContent = answer.problem_type || '—';
    document.getElementById('answer-confidence').textContent = answer.confidence || '—';

    const confidenceEl = document.getElementById('answer-confidence');
    confidenceEl.className = 'confidence-badge confidence-' + (answer.confidence || 'medium').toLowerCase();

    // Steps list
    const stepsList = document.getElementById('answer-steps');
    stepsList.innerHTML = '';
    (answer.steps || []).forEach((step, i) => {
      const li = document.createElement('li');
      li.innerHTML = `<span class="step-num">${i + 1}</span> ${escapeHtml(step)}`;
      stepsList.appendChild(li);
    });

    // Tool calls badges
    const toolsEl = document.getElementById('answer-tools');
    toolsEl.innerHTML = '';
    const uniqueTools = [...new Set(answer.tool_calls_made || [])];
    uniqueTools.forEach(tool => {
      const badge = document.createElement('span');
      badge.className = 'tool-badge';
      badge.textContent = tool;
      toolsEl.appendChild(badge);
    });
    if (uniqueTools.length === 0) {
      toolsEl.innerHTML = '<span class="muted">None</span>';
    }

    // Assumptions
    const assumptionsEl = document.getElementById('answer-assumptions');
    const assumptions = answer.assumptions || [];
    if (assumptions.length === 0) {
      assumptionsEl.innerHTML = '<span class="muted">None stated</span>';
    } else {
      assumptionsEl.innerHTML = assumptions.map(a => `<li>${escapeHtml(a)}</li>`).join('');
    }

    // Animate in
    finalAnswerSection.style.animation = 'none';
    void finalAnswerSection.offsetWidth;
    finalAnswerSection.style.animation = 'slideInUp 0.4s ease';
  }

  function formatReasoningText(text) {
    return escapeHtml(text)
      .replace(/(STEP \d+ —[^\n]*)/g, '<span class="step-header">$1</span>')
      .replace(/(FUNCTION_CALL:[^\n]+)/g, '<span class="func-call">$1</span>')
      .replace(/(⚠️[^\n]+)/g, '<span class="warning-line">$1</span>')
      .replace(/(\[ARITHMETIC\]|\[ALGEBRA\]|\[GEOMETRY\]|\[PHYSICS\]|\[CALCULUS\]|\[LOGIC\])/g,
        '<span class="type-tag">$1</span>')
      .replace(/\n/g, '<br>');
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function showError(msg) {
    const div = document.createElement('div');
    div.className = 'chain-block error-block';
    div.textContent = msg;
    reasoningChain.appendChild(div);
    setStatus('❌ Error occurred', false);
    reasoningChain.scrollTop = reasoningChain.scrollHeight;
  }

  function setStatus(text, active) {
    statusBar.textContent = text;
    statusBar.className = active ? 'status-bar active' : 'status-bar';
  }

  function resetBtn() {
    solveBtn.disabled = false;
    solveBtn.innerHTML = '⚡ Solve Problem';
  }

  function getPlaceholderHTML() {
    return `<div class="placeholder-hint">
      <div class="placeholder-icon">🧮</div>
      <p>Your step-by-step reasoning chain will appear here.</p>
      <p class="muted">Try one of the example problems above or type your own.</p>
    </div>`;
  }

  // Initialize placeholder
  reasoningChain.innerHTML = getPlaceholderHTML();
});
