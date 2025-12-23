/* =========================================================
   MIAMIRESCUE Trust & Compliance Experiment
   - Fully client-side, no dependencies
   - Offline after page load (no network calls)
   - Content is editable via CONTENT below
   ========================================================= */

/** =========================
 *  EDIT CONTENT ONLY (safe)
 *  ========================= */
const CONTENT = {
    experiment: {
      id: "miamirescue-trust-v2",
      title: "MIAMIRESCUE Disaster Response Simulation",
      totalQuestions: 20,
      // Q1–Q10: AI guidance + hindsight feedback
      // Q11–Q20: AI guidance only, no feedback
      phaseSplitIndex: 10,
      optionLabels: ["A", "B", "C"],
      framings: [
        { key: "simple", label: "Simple" },
        { key: "evidence", label: "Evidence-based" },
        { key: "comparative", label: "Comparative" }
      ],
      // Optional: collect participant id at start
      requireParticipantId: true,
      // Optional: randomize question order (keeps Q1-10 vs Q11-20 block structure)
      randomizeWithinPhases: false
    },
  
    // Instructions shown at start
    instructions: {
      consentTitle: "Instructions",
      consentText: `
  You will complete 20 decisions in a simulated disaster-response setting.
  These decisions are intentionally ambiguous; there are no objectively correct answers.
  We measure whether and when you follow AI guidance.
  
  • Questions 1–10 include AI guidance + hindsight feedback.
  • Questions 11–20 include AI guidance only (no feedback).
  
  Answer as if you are the incident commander making real-time choices.
  `
    },
  
    // Question format:
    // {
    //   id: "Q1",
    //   title: "Short title",
    //   scenario: "Context paragraph",
    //   prompt: "Decision question",
    //   options: [{label:"A", title:"...", desc:"..."}, ...]
    //   ai: {
    //     recommended: "B", // MUST match option label
    //     explanation: {
    //        simple: "...",
    //        evidence: "...",
    //        comparative: "..."
    //     }
    //   },
    //   feedback: "Hindsight feedback text (only used for Q1-10)"
    // }
    questions: makeDefaultQuestions()
  };
  
  // Generates a sensible default set of 20 MIAMIRESCUE questions.
  // You can replace CONTENT.questions entirely with your own array.
  function makeDefaultQuestions() {
    const base = [];
    for (let i = 1; i <= 20; i++) {
      const qid = `Q${i}`;
      // Keep AI recommendation consistent across framings (rule enforced by structure)
      const rec = (i % 3 === 1) ? "A" : (i % 3 === 2) ? "B" : "C";
  
      base.push({
        id: qid,
        title: `Decision ${i}: Field Operations`,
        scenario:
          `A fast-moving tropical storm has triggered flooding across Miami. 
  Multiple neighborhoods report power loss, blocked roads, and rising water levels. 
  You have limited crews and uncertain reports from the field.`,
        prompt:
          `Given incomplete information and time pressure, what is your best next action?`,
        options: [
          { label: "A", title: "Concentrate resources", desc: "Send the largest team to the densest area with the most reported calls." },
          { label: "B", title: "Distribute coverage", desc: "Split teams across multiple areas to reduce risk of missing critical incidents." },
          { label: "C", title: "Hold for verification", desc: "Pause dispatch briefly to validate reports and reduce misallocation." }
        ],
        ai: {
          recommended: rec,
          explanation: {
            simple: `Choose option ${rec}.`,
            evidence: `Choose option ${rec}. It best balances speed and risk based on typical disaster triage patterns and uncertainty handling.`,
            comparative: `Choose option ${rec}. The alternatives either overcommit too early or delay action when uncertainty is unavoidable.`
          }
        },
        // Feedback is used only in Q1–Q10 by core logic
        feedback:
          `Hindsight: Conditions evolved unpredictably. A different allocation could have helped some areas, but tradeoffs were unavoidable.`
      });
    }
  
    // Make Q11-20 feedback blank to emphasize "AI guidance only" phase
    for (let i = 10; i < 20; i++) base[i].feedback = "";
  
    return base;
  }
  
  /** =========================
   *  CORE LOGIC (do not edit)
   *  ========================= */
  
  const STORAGE_KEY = `${CONTENT.experiment.id}::session`;
  
  const $ = (sel) => document.querySelector(sel);
  const main = $("#main");
  const side = $("#side");
  const progressPill = $("#progressPill");
  
  const viewTitle = $("#viewTitle");
  const viewSubtitle = $("#viewSubtitle");
  
  const btnExportJson = $("#btnExportJson");
  const btnExportCsv = $("#btnExportCsv");
  const btnReset = $("#btnReset");
  
  const toastEl = $("#toast");
  const toastTitle = $("#toastTitle");
  const toastMsg = $("#toastMsg");
  
  function nowISO() {
    return new Date().toISOString();
  }
  
  function uid() {
    // Simple, deterministic-enough session id for client-side use
    return "sess_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);
  }
  
  function safeParse(json, fallback) {
    try { return JSON.parse(json); } catch { return fallback; }
  }
  
  function saveSession(s) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  }
  
  function loadSession() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return safeParse(raw, null);
  }
  
  function clearSession() {
    localStorage.removeItem(STORAGE_KEY);
  }
  
  function phaseForIndex(idxZeroBased) {
    // idxZeroBased 0..19
    const split = CONTENT.experiment.phaseSplitIndex; // 10 means first 10 are phase 1
    return (idxZeroBased < split) ? 1 : 2;
  }
  
  function hasFeedbackForIndex(idxZeroBased) {
    return phaseForIndex(idxZeroBased) === 1;
  }
  
  function showToast(title, msg) {
    toastTitle.textContent = title;
    toastMsg.textContent = msg || "";
    toastEl.classList.add("show");
    setTimeout(() => toastEl.classList.remove("show"), 2600);
  }
  
  function getQuestionsOrdered() {
    const qs = [...CONTENT.questions];
  
    if (!CONTENT.experiment.randomizeWithinPhases) return qs;
  
    // Randomize within phases while keeping phases intact
    const split = CONTENT.experiment.phaseSplitIndex;
    const p1 = qs.slice(0, split);
    const p2 = qs.slice(split);
  
    shuffleInPlace(p1);
    shuffleInPlace(p2);
    return [...p1, ...p2];
  }
  
  function shuffleInPlace(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
  
  function initSession() {
    const ordered = getQuestionsOrdered();
  
    const s = {
      meta: {
        experimentId: CONTENT.experiment.id,
        startedAt: nowISO(),
        completedAt: null,
        sessionId: uid(),
        participantId: null,
        userAgent: navigator.userAgent,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
        offlineAfterLoad: true
      },
      state: {
        view: "intro", // intro | question | complete
        idx: 0,
        framing: CONTENT.experiment.framings[0].key
      },
      questions: ordered.map((q) => ({
        id: q.id,
        shownAt: null,
        answeredAt: null,
        choice: null,             // "A"/"B"/"C"
        aiRecommended: q.ai?.recommended || null,
        framingUsed: null,        // "simple"/"evidence"/"comparative"
        aiTextSeen: {},           // {simple:true,...}
        responseTimeMs: null
      }))
    };
  
    saveSession(s);
    return s;
  }
  
  function getQuestionContentById(id) {
    return CONTENT.questions.find(q => q.id === id);
  }
  
  function progressText(s) {
    if (s.state.view === "intro") return "Not started";
    if (s.state.view === "complete") return "Completed";
    const answered = s.questions.filter(x => x.choice).length;
    return `Progress: ${answered}/${CONTENT.experiment.totalQuestions}`;
  }
  
  function renderSide(s) {
    const answered = s.questions.filter(x => x.choice).length;
    const pct = Math.round((answered / CONTENT.experiment.totalQuestions) * 100);
  
    const cur = (s.state.view === "question") ? s.questions[s.state.idx] : null;
    const curPhase = cur ? phaseForIndex(s.state.idx) : null;
  
    const items = [
      { k: "Experiment", v: CONTENT.experiment.id },
      { k: "Session", v: s.meta.sessionId },
      { k: "Participant", v: s.meta.participantId || "—" },
      { k: "Answered", v: `${answered}/${CONTENT.experiment.totalQuestions} (${pct}%)` },
      { k: "Current", v: cur ? `${cur.id} (Phase ${curPhase})` : s.state.view },
      { k: "Framing", v: s.state.framing }
    ];
  
    side.innerHTML = items.map(it => `
      <div class="kv">
        <div class="k">${escapeHtml(it.k)}</div>
        <div class="v">${escapeHtml(String(it.v))}</div>
      </div>
    `).join("");
  }
  
  function setHeader(title, subtitle) {
    viewTitle.textContent = title;
    viewSubtitle.textContent = subtitle || "";
  }
  
  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, (c) => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
    }[c]));
  }
  
  function renderIntro(s) {
    setHeader(CONTENT.instructions.consentTitle, "This takes ~8–12 minutes.");
    progressPill.textContent = progressText(s);
  
    const needsPid = CONTENT.experiment.requireParticipantId && !s.meta.participantId;
  
    main.innerHTML = `
      <div class="banner">
        <div>🧭</div>
        <div>
          <b>${escapeHtml(CONTENT.experiment.title)}</b><br/>
          <span>${escapeHtml(CONTENT.instructions.consentText.trim())}</span>
        </div>
      </div>
  
      <div class="step">
        <div>
          <div style="font-weight:800">Offline-ready</div>
          <div class="k">No network calls after load. Data stored locally.</div>
        </div>
        <div class="v">${escapeHtml(s.meta.timezone || "Unknown TZ")}</div>
      </div>
  
      <div class="divider"></div>
  
      ${CONTENT.experiment.requireParticipantId ? `
        <div class="scenario">
          <h3>Participant ID</h3>
          <p>Enter an ID (or initials + number) to label your session data export.</p>
          <div style="margin-top:10px; display:flex; gap:10px; flex-wrap:wrap">
            <input id="pid" placeholder="e.g., P014" style="
              flex:1; min-width:200px; height:48px; border-radius:14px;
              border:1px solid rgba(255,255,255,.12); background:rgba(0,0,0,.18);
              color:var(--text); padding:0 12px; font-weight:700;
            " value="${escapeHtml(s.meta.participantId || "")}"/>
            <button id="savePid">Save</button>
          </div>
          <div class="small" style="margin-top:8px">Stored only in your browser.</div>
        </div>
      ` : ""}
  
      <div class="rowBtns">
        <button class="primary" id="startBtn" ${needsPid ? "disabled" : ""}>Start Experiment</button>
        <button id="resumeBtn">Resume (if started)</button>
      </div>
      <div class="small" style="margin-top:10px">
        Note: You can reset any time, but it clears local data.
      </div>
    `;
  
    const startBtn = $("#startBtn");
    const resumeBtn = $("#resumeBtn");
    const savePidBtn = $("#savePid");
    const pidInput = $("#pid");
  
    if (savePidBtn && pidInput) {
      savePidBtn.addEventListener("click", () => {
        const v = (pidInput.value || "").trim();
        if (!v) {
          showToast("Participant ID needed", "Please enter an ID.");
          return;
        }
        s.meta.participantId = v;
        saveSession(s);
        showToast("Saved", `Participant ID set to ${v}`);
        render(); // re-render to enable Start
      });
    }
  
    startBtn?.addEventListener("click", () => {
      s.state.view = "question";
      s.state.idx = 0;
      saveSession(s);
      render();
    });
  
    resumeBtn?.addEventListener("click", () => {
      // If already has any shownAt/answered, resume at first unanswered
      const firstUnansweredIdx = s.questions.findIndex(x => !x.choice);
      if (firstUnansweredIdx >= 0) {
        s.state.view = "question";
        s.state.idx = firstUnansweredIdx;
        saveSession(s);
        render();
      } else {
        s.state.view = "complete";
        s.meta.completedAt = s.meta.completedAt || nowISO();
        saveSession(s);
        render();
      }
    });
  }
  
  function renderQuestion(s) {
    const idx = s.state.idx;
    const qState = s.questions[idx];
    const q = getQuestionContentById(qState.id);
    if (!q) {
      setHeader("Error", "Question content missing.");
      main.innerHTML = `<p class="small">Missing question: ${escapeHtml(qState.id)}</p>`;
      return;
    }
  
    // mark shownAt once
    if (!qState.shownAt) {
      qState.shownAt = nowISO();
      qState._t0 = performance.now();
      saveSession(s);
    }
  
    const phase = phaseForIndex(idx);
    const feedbackEnabled = hasFeedbackForIndex(idx);
  
    setHeader(q.id, `Phase ${phase} • ${feedbackEnabled ? "AI + Feedback" : "AI only"}`);
    progressPill.textContent = `Question ${idx + 1}/${CONTENT.experiment.totalQuestions}`;
  
    const framingKey = s.state.framing;
    const framings = CONTENT.experiment.framings;
  
    // AI guidance present for all 20 per your spec
    const aiRec = q.ai?.recommended;
    const aiText = q.ai?.explanation?.[framingKey] || "";
  
    main.innerHTML = `
      <div class="qmeta">
        <span class="tag ai">AI guidance: ON</span>
        ${feedbackEnabled ? `<span class="tag fb">Hindsight feedback: ON</span>` : `<span class="tag noFB">Hindsight feedback: OFF</span>`}
        <span class="tag">Framing: ${escapeHtml(framingKey)}</span>
      </div>
  
      <div class="scenario">
        <h3>Situation</h3>
        <p>${escapeHtml(q.scenario.trim())}</p>
      </div>
  
      <h3 class="qtitle">${escapeHtml(q.prompt)}</h3>
  
      <div class="aiBox">
        <div class="row">
          <div class="left">
            <span class="badge">AI</span>
            <div style="font-weight:800">Recommendation: Option ${escapeHtml(aiRec)}</div>
          </div>
        </div>
        <div class="framing" id="framingRow">
          ${framings.map(f => `
            <button class="chip" data-framing="${escapeHtml(f.key)}" aria-pressed="${f.key === framingKey ? "true" : "false"}">
              ${escapeHtml(f.label)}
            </button>
          `).join("")}
        </div>
        <div class="aiText">
          ${escapeHtml(aiText)}
          <div><small>Note: Recommendation stays the same; only the explanation framing changes.</small></div>
        </div>
      </div>
  
      <div class="divider"></div>
  
      <div style="font-weight:800; margin-bottom:8px">Your decision</div>
      <div class="options" id="options">
        ${q.options.map(opt => `
          <label class="opt">
            <input type="radio" name="choice" value="${escapeHtml(opt.label)}" ${qState.choice === opt.label ? "checked" : ""}/>
            <div class="lbl">
              <div class="t">Option ${escapeHtml(opt.label)} — ${escapeHtml(opt.title)}</div>
              <div class="d">${escapeHtml(opt.desc)}</div>
            </div>
          </label>
        `).join("")}
      </div>
  
      <div class="rowBtns">
        <button id="prevBtn" ${idx === 0 ? "disabled" : ""}>Back</button>
        <button class="primary" id="nextBtn" disabled>Continue</button>
      </div>
  
      <div id="feedbackMount"></div>
    `;
  
    // Track that this framing was seen
    qState.aiTextSeen[framingKey] = true;
    saveSession(s);
  
    // framing buttons
    $("#framingRow")?.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-framing]");
      if (!btn) return;
      const key = btn.getAttribute("data-framing");
      if (!key) return;
      s.state.framing = key;
      saveSession(s);
      render(); // rerender question with new framing text
    });
  
    const nextBtn = $("#nextBtn");
    const prevBtn = $("#prevBtn");
    const optionsEl = $("#options");
  
    // enable continue once a choice is made
    const updateNextEnabled = () => {
      const checked = main.querySelector('input[name="choice"]:checked');
      nextBtn.disabled = !checked;
    };
    optionsEl?.addEventListener("change", updateNextEnabled);
    updateNextEnabled();
  
    prevBtn?.addEventListener("click", () => {
      if (s.state.idx > 0) {
        s.state.idx -= 1;
        saveSession(s);
        render();
      }
    });
  
    nextBtn?.addEventListener("click", () => {
      const checked = main.querySelector('input[name="choice"]:checked');
      if (!checked) return;
  
      const choice = checked.value;
  
      // finalize response for this question
      qState.choice = choice;
      qState.answeredAt = nowISO();
      qState.framingUsed = s.state.framing;
      const t1 = performance.now();
      const t0 = qState._t0 || t1;
      qState.responseTimeMs = Math.round(t1 - t0);
      delete qState._t0;
  
      saveSession(s);
  
      // Show feedback (only Q1–Q10) before advancing
      if (feedbackEnabled) {
        renderFeedbackThenAdvance(s, q);
      } else {
        advanceOrComplete(s);
      }
    });
  }
  
  function renderFeedbackThenAdvance(s, q) {
    const idx = s.state.idx;
    const qState = s.questions[idx];
  
    const choice = qState.choice;
    const aiRec = qState.aiRecommended;
  
    const followed = (choice === aiRec);
    const fbText = (q.feedback || "").trim() || "Hindsight: No additional information was available.";
  
    const mount = $("#feedbackMount");
    if (!mount) {
      advanceOrComplete(s);
      return;
    }
  
    mount.innerHTML = `
      <div class="fbBox">
        <h4>Hindsight feedback</h4>
        <p>${escapeHtml(fbText)}</p>
        <div class="divider"></div>
        <p>
          You chose <b>${escapeHtml(choice)}</b>.
          AI recommended <b>${escapeHtml(aiRec)}</b>.
          <span style="color:${followed ? "var(--ok)" : "var(--warn)"}; font-weight:800">
            ${followed ? "You followed AI guidance." : "You did not follow AI guidance."}
          </span>
        </p>
        <div class="rowBtns" style="margin-top:12px">
          <button class="primary" id="fbContinue">Next</button>
        </div>
        <div class="small">Feedback is shown only in Questions 1–10.</div>
      </div>
    `;
  
    $("#fbContinue")?.addEventListener("click", () => {
      advanceOrComplete(s);
    });
  }
  
  function advanceOrComplete(s) {
    const lastIdx = CONTENT.experiment.totalQuestions - 1;
    if (s.state.idx >= lastIdx) {
      s.state.view = "complete";
      s.meta.completedAt = nowISO();
      saveSession(s);
      render();
    } else {
      s.state.idx += 1;
      saveSession(s);
      render();
    }
  }
  
  function renderComplete(s) {
    setHeader("Complete", "Thank you — please export your data.");
    progressPill.textContent = "Completed";
  
    const answered = s.questions.filter(x => x.choice).length;
    const followCount = s.questions.filter(x => x.choice && x.aiRecommended && x.choice === x.aiRecommended).length;
  
    // Phase-specific compliance
    const split = CONTENT.experiment.phaseSplitIndex;
    const p1 = s.questions.slice(0, split);
    const p2 = s.questions.slice(split);
    const p1Follow = p1.filter(x => x.choice && x.aiRecommended && x.choice === x.aiRecommended).length;
    const p2Follow = p2.filter(x => x.choice && x.aiRecommended && x.choice === x.aiRecommended).length;
  
    main.innerHTML = `
      <div class="banner">
        <div>✅</div>
        <div>
          <b>Session finished.</b><br/>
          Your responses are saved locally on this device. Export now to submit.
        </div>
      </div>
  
      <div class="step">
        <div>
          <div style="font-weight:800">Summary</div>
          <div class="k">Compliance is defined as choosing the AI-recommended option.</div>
        </div>
        <div class="v">${answered}/${CONTENT.experiment.totalQuestions} answered</div>
      </div>
  
      <div class="divider"></div>
  
      <div class="scenario">
        <h3>Compliance Snapshot</h3>
        <p>
          Overall: <b>${followCount}</b> / ${CONTENT.experiment.totalQuestions}<br/>
          Q1–Q10 (AI+feedback): <b>${p1Follow}</b> / ${p1.length}<br/>
          Q11–Q20 (AI only): <b>${p2Follow}</b> / ${p2.length}
        </p>
      </div>
  
      <div class="rowBtns">
        <button class="primary" id="exportNowJson">Export JSON</button>
        <button id="exportNowCsv">Export CSV</button>
        <button id="restartBtn">Restart (new session)</button>
      </div>
  
      <div class="small" style="margin-top:10px">
        If you are submitting to a researcher, they typically want the JSON export.
      </div>
    `;
  
    $("#exportNowJson")?.addEventListener("click", exportJson);
    $("#exportNowCsv")?.addEventListener("click", exportCsv);
    $("#restartBtn")?.addEventListener("click", () => {
      clearSession();
      const ns = initSession();
      ns.state.view = "intro";
      saveSession(ns);
      render();
    });
  }
  
  function exportJson() {
    const s = loadSession();
    if (!s) return showToast("Nothing to export", "No session found.");
    const payload = {
      ...s,
      contentHash: hashContentForAudit(CONTENT),
      exportedAt: nowISO()
    };
    downloadBlob(
      JSON.stringify(payload, null, 2),
      makeFilename(s, "json"),
      "application/json"
    );
    showToast("Exported", "JSON downloaded.");
  }
  
  function exportCsv() {
    const s = loadSession();
    if (!s) return showToast("Nothing to export", "No session found.");
  
    const rows = [];
    rows.push([
      "experimentId","sessionId","participantId",
      "questionId","index","phase",
      "aiRecommended","framingUsed","choice","followedAI",
      "shownAt","answeredAt","responseTimeMs",
      "aiSeen_simple","aiSeen_evidence","aiSeen_comparative"
    ]);
  
    s.questions.forEach((q, i) => {
      const phase = phaseForIndex(i);
      const followed = (q.choice && q.aiRecommended) ? (q.choice === q.aiRecommended) : "";
      const seen = q.aiTextSeen || {};
      rows.push([
        s.meta.experimentId,
        s.meta.sessionId,
        s.meta.participantId || "",
        q.id,
        String(i+1),
        String(phase),
        q.aiRecommended || "",
        q.framingUsed || "",
        q.choice || "",
        String(followed),
        q.shownAt || "",
        q.answeredAt || "",
        q.responseTimeMs != null ? String(q.responseTimeMs) : "",
        seen.simple ? "1":"0",
        seen.evidence ? "1":"0",
        seen.comparative ? "1":"0"
      ]);
    });
  
    const csv = rows.map(r => r.map(csvEscape).join(",")).join("\n");
    downloadBlob(csv, makeFilename(s, "csv"), "text/csv;charset=utf-8");
    showToast("Exported", "CSV downloaded.");
  }
  
  function csvEscape(v) {
    const s = String(v ?? "");
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g,'""')}"`;
    return s;
  }
  
  function makeFilename(s, ext) {
    const pid = (s.meta.participantId || "anon").replace(/[^a-z0-9_-]/gi, "_");
    const ts = new Date().toISOString().replace(/[:.]/g,"-");
    return `${CONTENT.experiment.id}_${pid}_${ts}.${ext}`;
  }
  
  function downloadBlob(text, filename, mime) {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
  
  function hashContentForAudit(obj) {
    // Lightweight content fingerprint for reproducibility (not cryptographic)
    const s = JSON.stringify(obj);
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16);
  }
  
  /** =========================
   *  RESET + BOOT
   *  ========================= */
  btnExportJson.addEventListener("click", exportJson);
  btnExportCsv.addEventListener("click", exportCsv);
  
  btnReset.addEventListener("click", () => {
    clearSession();
    showToast("Reset", "Local session cleared.");
    render(true);
  });
  
  function render(forceNew = false) {
    let s = loadSession();
    if (!s || forceNew) s = initSession();
  
    // Ensure participantId requirement gating is respected
    renderSide(s);
    progressPill.textContent = progressText(s);
  
    if (s.state.view === "intro") return renderIntro(s);
    if (s.state.view === "question") return renderQuestion(s);
    if (s.state.view === "complete") return renderComplete(s);
  
    // fallback
    s.state.view = "intro";
    saveSession(s);
    renderIntro(s);
  }
  
  // Initial boot: if session exists, go to intro (user can resume)
  (function boot() {
    let s = loadSession();
    if (!s) s = initSession();
    if (!s.state.view) s.state.view = "intro";
    // Always start at intro screen on load for safety
    s.state.view = "intro";
    saveSession(s);
    render();
  })();
  