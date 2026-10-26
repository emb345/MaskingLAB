(() => {
  const STORAGE_KEY = "frequency-masking-lab.measurements.v1";
  const MASKERS = [500, 1000, 2000, 4000];
  const FREQUENCY_RATIOS = [0.5, 0.7, 0.85, 0.95, 1, 1.05, 1.2, 1.5, 2];
  const COLORS = { 500: "#bb6a43", 1000: "#367966", 2000: "#4e7894", 4000: "#776ba6", baseline: "#929a91" };
  const MAX_TRIALS = 32;
  const TARGET_REVERSALS = 8;
  const TONE_SECONDS = 0.46;
  const GAP_SECONDS = 0.52;

  const el = (id) => document.getElementById(id);
  const ui = {
    maskerFrequency: el("maskerFrequency"), maskerLevel: el("maskerLevel"), maskerLevelValue: el("maskerLevelValue"),
    probeFrequency: el("probeFrequency"), probeStart: el("probeStart"), probeStartValue: el("probeStartValue"),
    baselineMode: el("baselineMode"), startRun: el("startRun"), runTitle: el("runTitle"), runStatus: el("runStatus"),
    trialInstructions: el("trialInstructions"), trialCount: el("trialCount"), reversalCount: el("reversalCount"),
    currentLevel: el("currentLevel"), progressBar: el("progressBar"), playTrial: el("playTrial"),
    choices: Array.from(document.querySelectorAll(".choice")), responseHint: el("responseHint"), runFeedback: el("runFeedback"),
    runContext: el("runContext"), stopRun: el("stopRun"), interval1Dot: el("interval1Dot"), interval2Dot: el("interval2Dot"),
    maskingChart: el("maskingChart"), chartEmpty: el("chartEmpty"), chartLegend: el("chartLegend"), dataCount: el("dataCount"), maskerLevelLegend: el("maskerLevelLegend"),
    thresholdMode: el("thresholdMode"), maskingMode: el("maskingMode"), measurementTable: el("measurementTable"),
    exportPdf: el("exportPdf"), exportJpeg: el("exportJpeg"), exportReport: el("exportReport"),
    clearData: el("clearData"), setup: document.querySelector(".setup"),
    liveCurve: document.querySelector(".live-curve"), liveCurveToggle: el("liveCurveToggle"),
    liveMaskingChart: el("liveMaskingChart"), liveCurveState: el("liveCurveState"), liveCurveCondition: el("liveCurveCondition"),
    liveCurveLevel: el("liveCurveLevel"), liveCurveHint: el("liveCurveHint"),
  };

  let measurements = loadMeasurements();
  let chartMode = "threshold";
  let run = null;
  let audioContext = null;
  let activeSources = [];
  let playTimer = null;
  let responseTimer = null;

  function loadMeasurements() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      if (!Array.isArray(parsed)) return [];
      const valid = parsed.filter((item) => item && Number.isFinite(item.thresholdDbfs));
      const cleaned = valid.map((item) => {
        const { date, ...measurement } = item;
        return measurement;
      });
      if (valid.some((item) => Object.hasOwn(item, "date"))) {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned)); } catch (_) {}
      }
      return cleaned;
    } catch (error) {
      console.warn("Could not read saved frequency masking measurements.", error);
      return [];
    }
  }

  function storeMeasurements() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(measurements));
    } catch (error) {
      ui.runFeedback.textContent = "This browser could not save locally. Export your data before closing the page.";
    }
  }

  function dbLabel(value) { return `${value < 0 ? "−" : ""}${Math.abs(Math.round(value))} dBFS`; }
  function hzLabel(value) { return `${Number(value).toLocaleString("en-US")} Hz`; }
  function frequencyText(value) { return value >= 1000 ? `${(value / 1000).toFixed(value % 1000 ? 2 : 0).replace(/\.0$/, "")} kHz` : `${value} Hz`; }

  function recommendedProbeFrequencies(maskerHz) {
    const frequencies = [...new Set(FREQUENCY_RATIOS.map((ratio) => Math.max(250, Math.min(8000, Math.round((maskerHz * ratio) / 10) * 10))))];
    return frequencies.sort((a, b) => a - b);
  }

  function populateProbeFrequencies(preferred) {
    const frequencies = recommendedProbeFrequencies(Number(ui.maskerFrequency.value));
    ui.probeFrequency.innerHTML = frequencies.map((hz) => `<option value="${hz}">${hzLabel(hz)}${hz === Number(ui.maskerFrequency.value) ? " · masker center" : ""}</option>`).join("");
    if (preferred && frequencies.includes(Number(preferred))) ui.probeFrequency.value = String(preferred);
    else ui.probeFrequency.value = String(Number(ui.maskerFrequency.value));
  }

  function setControlsDisabled(disabled) {
    ui.setup.querySelectorAll("select, input").forEach((control) => { control.disabled = disabled; });
    ui.startRun.disabled = disabled;
  }

  function renderSetupValues() {
    ui.maskerLevelValue.textContent = dbLabel(Number(ui.maskerLevel.value));
    ui.probeStartValue.textContent = dbLabel(Number(ui.probeStart.value));
    ui.maskerLevel.disabled = Boolean(run) || ui.baselineMode.checked;
    if (ui.baselineMode.checked && !run) ui.maskerLevelValue.textContent = "OFF";
  }

  function setFeedback(message, kind = "") {
    ui.runFeedback.textContent = message;
    ui.runFeedback.className = `run-feedback${kind ? ` is-${kind}` : ""}`;
  }

  function setStatus(label, kind = "") {
    ui.runStatus.innerHTML = `<span class="status-dot"></span>${label}`;
    ui.runStatus.className = `status-pill${kind ? ` is-${kind}` : ""}`;
  }

  function beginRun() {
    if (run) return;
    run = {
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      maskerHz: Number(ui.maskerFrequency.value), maskerLevelDbfs: Number(ui.maskerLevel.value),
      probeHz: Number(ui.probeFrequency.value), baseline: ui.baselineMode.checked,
      currentDbfs: Number(ui.probeStart.value), startDbfs: Number(ui.probeStart.value),
      stepDb: 6, correctInRow: 0, direction: 0, reversalLevels: [], trial: 0,
      isPlaying: false, awaitingResponse: false, hasPendingTrial: false, targetInterval: 0, levels: [],
    };
    setControlsDisabled(true);
    ui.playTrial.disabled = false;
    ui.playTrial.querySelector("span:last-child").textContent = "Play both intervals";
    ui.stopRun.disabled = false;
    ui.choices.forEach((button) => { button.disabled = true; });
    ui.runTitle.textContent = run.baseline ? `Baseline · ${frequencyText(run.probeHz)}` : `${frequencyText(run.maskerHz)} masker`;
    ui.trialInstructions.textContent = run.baseline
      ? "Baseline trials have one audible probe tone and one intentionally silent interval. Choose the tone's interval, or select No difference if you couldn't tell. Replay the same pair if needed."
      : "One interval contains masker + probe; the other has masker alone. Choose the probe interval, or select No difference if you couldn't tell. Replay the same pair if needed.";
    ui.runContext.textContent = `${run.baseline ? "Unmasked baseline" : `${hzLabel(run.maskerHz)} masker · ${dbLabel(run.maskerLevelDbfs)}`}  /  probe ${hzLabel(run.probeHz)}`;
    ui.responseHint.textContent = "Keys: 1 or 2 · 3 = No difference";
    setStatus("In progress", "active");
    setFeedback(run.baseline
      ? "Baseline check: one interval has the probe tone; the other is intentionally silent."
      : "Press play to hear both intervals, then choose 1, 2, or No difference.");
    updateRunDisplay();
    renderSetupValues();
    renderDashboard();
  }

  function updateRunDisplay() {
    if (!run) return;
    ui.trialCount.innerHTML = `${run.trial} <small>/ ${MAX_TRIALS}</small>`;
    ui.reversalCount.innerHTML = `${run.reversalLevels.length} <small>/ ${TARGET_REVERSALS}</small>`;
    ui.currentLevel.textContent = dbLabel(run.currentDbfs);
    ui.progressBar.style.width = `${Math.min(100, (run.trial / MAX_TRIALS) * 100)}%`;
  }

  async function getAudioContext() {
    if (!audioContext) {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) throw new Error("Web Audio is unavailable in this browser.");
      audioContext = new Context();
    }
    if (audioContext.state === "suspended") await audioContext.resume();
    return audioContext;
  }

  function addTone(context, frequency, dbfs, startAt, duration) {
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    const amplitude = 10 ** (dbfs / 20);
    const ramp = 0.018;
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, startAt);
    envelope.gain.setValueAtTime(0, startAt);
    envelope.gain.linearRampToValueAtTime(amplitude, startAt + ramp);
    envelope.gain.setValueAtTime(amplitude, startAt + duration - ramp);
    envelope.gain.linearRampToValueAtTime(0, startAt + duration);
    oscillator.connect(envelope);
    envelope.connect(context.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + duration + 0.01);
    activeSources.push(oscillator);
  }

  async function playBothIntervals() {
    if (!run || run.isPlaying || (run.hasPendingTrial && !run.awaitingResponse)) return;
    const trialRun = run;
    const replaying = trialRun.hasPendingTrial;
    trialRun.isPlaying = true;
    trialRun.awaitingResponse = false;
    ui.playTrial.disabled = true;
    ui.playTrial.querySelector("span:last-child").textContent = "Playing intervals…";
    ui.choices.forEach((button) => { button.disabled = true; });
    try {
      const context = await getAudioContext();
      if (run !== trialRun) return;
      if (!replaying) {
        run.trial += 1;
        run.targetInterval = Math.random() < 0.5 ? 1 : 2;
        run.hasPendingTrial = true;
      }
      updateRunDisplay();
      renderLiveCurve();
      setFeedback("Listen to both intervals…");
      const beginAt = context.currentTime + 0.08;
      const secondAt = beginAt + TONE_SECONDS + GAP_SECONDS;
      const master = context.createGain();
      master.gain.setValueAtTime(0.42, beginAt);
      master.connect(context.destination);
      // Route tones through a quiet master stage so two digital tones have headroom.
      function tone(frequency, level, at) {
        const oscillator = context.createOscillator();
        const envelope = context.createGain();
        const amplitude = 10 ** (level / 20);
        const ramp = 0.018;
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(frequency, at);
        envelope.gain.setValueAtTime(0, at);
        envelope.gain.linearRampToValueAtTime(amplitude, at + ramp);
        envelope.gain.setValueAtTime(amplitude, at + TONE_SECONDS - ramp);
        envelope.gain.linearRampToValueAtTime(0, at + TONE_SECONDS);
        oscillator.connect(envelope);
        envelope.connect(master);
        oscillator.start(at);
        oscillator.stop(at + TONE_SECONDS + 0.01);
        activeSources.push(oscillator);
      }
      for (const interval of [1, 2]) {
        const at = interval === 1 ? beginAt : secondAt;
        if (!run.baseline) tone(run.maskerHz, run.maskerLevelDbfs, at);
        if (interval === run.targetInterval) tone(run.probeHz, run.currentDbfs, at);
      }
      ui.interval1Dot.classList.toggle("is-playing", true);
      ui.interval2Dot.classList.toggle("is-playing", false);
      playTimer = window.setTimeout(() => {
        ui.interval1Dot.classList.toggle("is-playing", false);
        ui.interval2Dot.classList.toggle("is-playing", true);
      }, (TONE_SECONDS + GAP_SECONDS) * 1000);
      responseTimer = window.setTimeout(() => {
        if (!run) return;
        ui.interval1Dot.classList.remove("is-playing");
        ui.interval2Dot.classList.remove("is-playing");
        run.isPlaying = false;
        run.awaitingResponse = true;
        activeSources = [];
        ui.playTrial.disabled = false;
        ui.playTrial.querySelector("span:last-child").textContent = "Replay same trial";
        ui.choices.forEach((button) => { button.disabled = false; });
        ui.responseHint.textContent = "Replay if needed · keys 1/2/3";
        setFeedback(run.baseline
          ? "Which interval had the tone? The other interval was intentionally silent."
          : "Which interval contained the probe, or was there no audible difference?");
        renderLiveCurve();
      }, (2 * TONE_SECONDS + GAP_SECONDS + 0.12) * 1000);
    } catch (error) {
      if (run !== trialRun) return;
      run.isPlaying = false;
      run.awaitingResponse = Boolean(run.hasPendingTrial);
      ui.playTrial.disabled = false;
      ui.playTrial.querySelector("span:last-child").textContent = run.hasPendingTrial ? "Replay same trial" : "Play both intervals";
      ui.choices.forEach((button) => { button.disabled = true; });
      setFeedback(error.message || "Could not play the tones. Check browser audio permissions.", "wrong");
      renderLiveCurve();
    }
  }

  function answerTrial(choice) {
    if (!run || !run.awaitingResponse) return;
    run.awaitingResponse = false;
    run.hasPendingTrial = false;
    ui.playTrial.disabled = true;
    ui.playTrial.querySelector("span:last-child").textContent = "Play both intervals";
    const uncertain = choice === "uncertain";
    const correct = !uncertain && Number(choice) === run.targetInterval;
    run.levels.push({ level: run.currentDbfs, correct, uncertain });
    const previousDirection = run.direction;
    let newDirection = 0;
    if (correct) {
      run.correctInRow += 1;
      if (run.correctInRow >= 2) { newDirection = -1; run.correctInRow = 0; }
    } else {
      newDirection = 1;
      run.correctInRow = 0;
    }
    if (newDirection && previousDirection && newDirection !== previousDirection) {
      run.reversalLevels.push(run.currentDbfs);
      if (run.reversalLevels.length === 2) run.stepDb = 2;
    }
    if (newDirection) {
      run.direction = newDirection;
      run.currentDbfs = Math.max(-72, Math.min(-6, run.currentDbfs + newDirection * run.stepDb));
    }
    ui.choices.forEach((button) => { button.disabled = true; });
    ui.responseHint.textContent = uncertain ? "No difference reported" : correct ? "Correct interval" : "Probe was in the other interval";
    setFeedback(
      uncertain ? "No difference detected — the probe level is stepping up." : correct ? "Correct — the probe level is stepping down." : "Not quite — the probe level is stepping up.",
      correct ? "correct" : "wrong",
    );
    updateRunDisplay();
    renderDashboard();
    if (run.reversalLevels.length >= TARGET_REVERSALS) {
      finishRun("target");
      return;
    }
    if (run.trial >= MAX_TRIALS) {
      finishRun("limit");
      return;
    }
    ui.playTrial.disabled = false;
    responseTimer = window.setTimeout(() => {
      if (run && !run.isPlaying && !run.awaitingResponse) {
        ui.responseHint.textContent = "Keys: 1 or 2 · 3 = No difference";
        setFeedback("Press play for the next trial.");
      }
    }, 700);
  }

  function finishRun(reason, userStopped = false) {
    if (!run) return;
    clearTimeout(playTimer);
    clearTimeout(responseTimer);
    activeSources.forEach((source) => { try { source.stop(); } catch (_) {} });
    activeSources = [];
    ui.interval1Dot.classList.remove("is-playing");
    ui.interval2Dot.classList.remove("is-playing");
    const finished = run;
    const usableReversals = finished.reversalLevels.slice(-6);
    const canEstimate = usableReversals.length >= 4;
    if (canEstimate) {
      const threshold = usableReversals.reduce((sum, level) => sum + level, 0) / usableReversals.length;
      measurements.push({
        id: finished.id, condition: finished.baseline ? "baseline" : "masked",
        maskerHz: finished.maskerHz, maskerLevelDbfs: finished.maskerLevelDbfs, probeHz: finished.probeHz,
        thresholdDbfs: Math.round(threshold * 10) / 10, trials: finished.trial,
        reversals: finished.reversalLevels.length, reversalLevelsDbfs: finished.reversalLevels,
        correctRate: Math.round((finished.levels.filter((item) => item.correct).length / Math.max(1, finished.levels.length)) * 100),
        uncertainResponses: finished.levels.filter((item) => item.uncertain).length,
        startLevelDbfs: finished.startDbfs, method: "2-down/1-up", completion: reason,
      });
      storeMeasurements();
      ui.runTitle.textContent = "Threshold saved";
      setStatus("Run complete", "done");
      const note = reason === "target" ? "8 reversals" : reason === "limit" ? `${finished.reversalLevels.length} reversals before the trial limit` : userStopped ? "stopped early" : "partial run";
      setFeedback(`${dbLabel(threshold)} estimated from ${usableReversals.length} reversal levels · ${note}.`, "result");
    } else {
      ui.runTitle.textContent = "Run ended early";
      setStatus("No estimate", "");
      setFeedback(`Only ${finished.reversalLevels.length} reversals; at least 4 are needed for a saved threshold. Try again with a closer starting level.`, "wrong");
    }
    ui.trialInstructions.textContent = "Choose another probe frequency to build the curve, or repeat this point to improve its estimate.";
    ui.playTrial.disabled = true;
    ui.playTrial.querySelector("span:last-child").textContent = "Play both intervals";
    ui.choices.forEach((button) => { button.disabled = true; });
    ui.stopRun.disabled = true;
    ui.runContext.textContent = canEstimate ? `${hzLabel(finished.probeHz)} · ${finished.baseline ? "baseline" : `${hzLabel(finished.maskerHz)} masker`}` : "No threshold saved";
    run = null;
    setControlsDisabled(false);
    renderSetupValues();
    renderDashboard();
  }

  function resetAllData() {
    const savedCount = measurements.length;
    const discardingRun = Boolean(run);
    const changes = [`delete all ${savedCount} saved measurement${savedCount === 1 ? "" : "s"}`];
    if (discardingRun) changes.push("discard the staircase in progress");
    changes.push("restore the setup defaults", "clear the charts");
    const changesText = `${changes.slice(0, -1).join(", ")}, and ${changes[changes.length - 1]}`;
    if (!window.confirm(`Reset the experiment? This will ${changesText}. Export a copy first if you want to keep these results.`)) return;

    clearTimeout(playTimer);
    clearTimeout(responseTimer);
    activeSources.forEach((source) => { try { source.stop(); } catch (_) {} });
    activeSources = [];
    ui.interval1Dot.classList.remove("is-playing");
    ui.interval2Dot.classList.remove("is-playing");
    run = null;
    measurements = [];

    ui.maskerFrequency.value = "1000";
    ui.maskerLevel.value = "-24";
    ui.probeStart.value = "-36";
    ui.baselineMode.checked = false;
    populateProbeFrequencies();
    chartMode = "threshold";
    ui.thresholdMode.classList.add("is-active");
    ui.maskingMode.classList.remove("is-active");

    setControlsDisabled(false);
    ui.runTitle.textContent = "Ready when you are";
    ui.trialInstructions.textContent = "Start a run to hear two short intervals. One contains the probe tone. Choose the interval where you heard it.";
    ui.trialCount.innerHTML = `— <small>/ ${MAX_TRIALS}</small>`;
    ui.reversalCount.innerHTML = `0 <small>/ ${TARGET_REVERSALS}</small>`;
    ui.currentLevel.textContent = "—";
    ui.progressBar.style.width = "0%";
    ui.playTrial.disabled = true;
    ui.playTrial.querySelector("span:last-child").textContent = "Play both intervals";
    ui.choices.forEach((button) => { button.disabled = true; });
    ui.responseHint.textContent = "Keys: 1 or 2 · 3 = No difference";
    ui.stopRun.disabled = true;
    ui.runContext.textContent = "No active run";
    setStatus("Setup");
    setFeedback("All measurements and any active staircase were reset.");

    storeMeasurements();
    renderSetupValues();
    renderDashboard();
  }

  function averageByProbe(records) {
    const groups = new Map();
    records.forEach((record) => {
      const key = Number(record.probeHz);
      const item = groups.get(key) || { total: 0, count: 0 };
      item.total += Number(record.thresholdDbfs);
      item.count += 1;
      groups.set(key, item);
    });
    return new Map([...groups.entries()].map(([key, value]) => [key, value.total / value.count]));
  }

  function chartData(mode = chartMode, includeLive = true) {
    const baselines = averageByProbe(measurements.filter((item) => item.condition === "baseline"));
    const series = [];
    if (mode === "threshold" && baselines.size) {
      const points = [...baselines].map(([x, y]) => ({ x, y })).sort((a, b) => a.x - b.x);
      series.push({ name: "No-mask baseline", color: COLORS.baseline, dashed: true, markerHz: null, points });
    }
    MASKERS.forEach((maskerHz) => {
      const groupMap = new Map();
      const groupMeasurements = measurements.filter((item) => item.condition === "masked" && Number(item.maskerHz) === maskerHz);
      groupMeasurements.forEach((item) => {
        const x = Number(item.probeHz);
        let y = Number(item.thresholdDbfs);
        if (mode === "masking") {
          if (!baselines.has(x)) return;
          y -= baselines.get(x);
        }
        const prior = groupMap.get(x) || { sum: 0, count: 0 };
        prior.sum += y;
        prior.count += 1;
        groupMap.set(x, prior);
      });
      const points = [...groupMap.entries()].map(([x, value]) => ({ x, y: value.sum / value.count })).sort((a, b) => a.x - b.x);
      const maskerLevels = mode === "threshold"
        ? [...new Set(groupMeasurements.map((item) => Number(item.maskerLevelDbfs)).filter(Number.isFinite))].sort((a, b) => a - b)
        : [];
      if (points.length) series.push({ name: `${frequencyText(maskerHz)} masker`, color: COLORS[maskerHz], markerHz: maskerHz, points, maskerLevels });
    });

    if (includeLive && run) {
      let liveSeries = null;
      let liveY = run.currentDbfs;
      if (run.baseline && mode === "threshold") {
        liveSeries = series.find((item) => item.name === "No-mask baseline");
        if (!liveSeries) {
          liveSeries = { name: "No-mask baseline", color: COLORS.baseline, dashed: true, markerHz: null, points: [] };
          series.push(liveSeries);
        }
      } else if (!run.baseline) {
        if (mode === "masking") {
          if (!baselines.has(run.probeHz)) liveY = null;
          else liveY -= baselines.get(run.probeHz);
        }
        if (liveY !== null) {
          liveSeries = series.find((item) => item.markerHz === run.maskerHz);
          if (!liveSeries) {
            liveSeries = { name: `${frequencyText(run.maskerHz)} masker`, color: COLORS[run.maskerHz], markerHz: run.maskerHz, points: [], maskerLevels: [] };
            series.push(liveSeries);
          }
        }
      }
      if (liveSeries) {
        if (!run.baseline && mode === "threshold") {
          liveSeries.maskerLevels = [...new Set([...(liveSeries.maskerLevels || []), run.maskerLevelDbfs])].sort((a, b) => a - b);
        }
        liveSeries.hasLive = true;
        const existing = liveSeries.points.findIndex((point) => point.x === run.probeHz);
        const point = { x: run.probeHz, y: liveY, isLive: true };
        if (existing >= 0) liveSeries.points[existing] = point;
        else liveSeries.points.push(point);
        liveSeries.points.sort((a, b) => a.x - b.x);
      }
    }
    return series;
  }

  function drawPlot(svg, series, mode, compact = false) {
    const allPoints = series.flatMap((item) => item.points);
    const maskerLevels = mode === "threshold" ? series.flatMap((item) => item.maskerLevels || []) : [];
    const plottedValues = [...allPoints.map((point) => point.y), ...maskerLevels];
    const W = compact ? 360 : 900, H = compact ? 210 : 400;
    const left = compact ? 39 : 66, right = compact ? 9 : 23, top = compact ? 9 : 20, bottom = compact ? 32 : 55;
    const plotW = W - left - right, plotH = H - top - bottom;
    const xMin = 250, xMax = 8000;
    let yMin, yMax;
    if (mode === "masking") {
      const lo = Math.min(0, ...allPoints.map((point) => point.y));
      const hi = Math.max(0, ...allPoints.map((point) => point.y));
      yMin = Math.floor((lo - 3) / 5) * 5;
      yMax = Math.ceil((hi + 3) / 5) * 5;
      if (yMax - yMin < 15) { yMin -= 5; yMax += 5; }
    } else {
      const lo = plottedValues.length ? Math.min(...plottedValues) : -60;
      const hi = plottedValues.length ? Math.max(...plottedValues) : -18;
      yMin = Math.max(-72, Math.floor((lo - (compact ? 5 : 4)) / 5) * 5);
      yMax = Math.min(-6, Math.ceil((hi + (compact ? 5 : 4)) / 5) * 5);
      if (yMax - yMin < 15) { yMin = Math.max(-72, yMin - 5); yMax = Math.min(-6, yMax + 5); }
    }
    const x = (value) => left + ((Math.log10(value) - Math.log10(xMin)) / (Math.log10(xMax) - Math.log10(xMin))) * plotW;
    const y = (value) => top + ((yMax - value) / (yMax - yMin)) * plotH;
    const yStep = compact ? 10 : (yMax - yMin > 48 ? 10 : 5);
    let markup = "";
    for (let tick = Math.ceil(yMin / yStep) * yStep; tick <= yMax; tick += yStep) {
      const ty = y(tick);
      markup += `<line class="chart-grid" x1="${left}" y1="${ty}" x2="${W - right}" y2="${ty}"/><text class="${compact ? "live-chart-label" : "chart-label"}" x="${left - 5}" y="${ty + 3}" text-anchor="end">${tick}</text>`;
    }
    const xTicks = compact ? [250, 1000, 4000, 8000] : [250, 500, 1000, 2000, 4000, 8000];
    xTicks.forEach((tick) => {
      const tx = x(tick);
      const label = compact ? ({ 250: "250", 1000: "1k", 4000: "4k", 8000: "8k" })[tick] : frequencyText(tick);
      markup += `<line class="chart-grid" x1="${tx}" y1="${top}" x2="${tx}" y2="${H - bottom}"/><text class="${compact ? "live-chart-label" : "chart-label-x"}" x="${tx}" y="${H - bottom + (compact ? 14 : 20)}" text-anchor="middle">${label}</text>`;
    });
    markup += `<line class="chart-axis" x1="${left}" y1="${H - bottom}" x2="${W - right}" y2="${H - bottom}"/><line class="chart-axis" x1="${left}" y1="${top}" x2="${left}" y2="${H - bottom}"/>`;
    if (!compact) {
      const yTitle = mode === "threshold" ? "PROBE THRESHOLD · dBFS" : "MASKING AMOUNT · dB";
      markup += `<text class="chart-label" transform="translate(15 ${top + plotH / 2}) rotate(-90)" text-anchor="middle" letter-spacing="1">${yTitle}</text>`;
      markup += `<text class="chart-label" x="${left + plotW / 2}" y="${H - 5}" text-anchor="middle" letter-spacing="1">PROBE FREQUENCY · LOG SCALE</text>`;
    }
    series.forEach((item) => {
      if (mode === "threshold") {
        (item.maskerLevels || []).forEach((level) => {
          const levelY = y(level);
          markup += `<line class="chart-masker-level" x1="${left}" y1="${levelY}" x2="${W - right}" y2="${levelY}" stroke="${item.color}"><title>${item.name} level · ${dbLabel(level)}</title></line>`;
        });
      }
      if (item.markerHz && item.markerHz >= xMin && item.markerHz <= xMax) {
        const mx = x(item.markerHz);
        markup += `<line class="chart-masker" x1="${mx}" y1="${top}" x2="${mx}" y2="${H - bottom}" stroke="${item.color}"/>`;
      }
      if (item.points.length > 1) {
        const path = item.points.map((point, index) => `${index ? "L" : "M"}${x(point.x).toFixed(1)},${y(point.y).toFixed(1)}`).join(" ");
        markup += `<path class="chart-series" d="${path}" stroke="${item.color}" ${item.dashed || item.hasLive ? 'stroke-dasharray="5 5"' : ""}/>`;
      }
      item.points.forEach((point) => {
        if (point.isLive) markup += `<circle class="chart-live-ring" cx="${x(point.x).toFixed(1)}" cy="${y(point.y).toFixed(1)}" r="7" stroke="${item.color}"><title>Current probe level · ${hzLabel(point.x)} · ${point.y.toFixed(1)} ${mode === "threshold" ? "dBFS" : "dB"} · provisional</title></circle>`;
        markup += `<circle class="${point.isLive ? "chart-live-point" : "chart-point"}" cx="${x(point.x).toFixed(1)}" cy="${y(point.y).toFixed(1)}" r="${point.isLive ? 3.4 : compact ? 3 : 4.5}" fill="${item.color}"><title>${point.isLive ? "Current probe level" : item.name} · ${hzLabel(point.x)} · ${point.y.toFixed(1)} ${mode === "threshold" ? "dBFS" : "dB"}</title></circle>`;
      });
    });
    svg.innerHTML = markup;
  }

  function renderChart() {
    const series = chartData(chartMode, true);
    const hasPoints = series.some((item) => item.points.length);
    ui.maskerLevelLegend.hidden = chartMode !== "threshold" || !series.some((item) => (item.maskerLevels || []).length);
    ui.chartEmpty.hidden = hasPoints;
    ui.chartEmpty.querySelector("strong").textContent = chartMode === "masking" ? "Add matching baseline runs" : "Your curves will take shape here";
    ui.chartEmpty.querySelector("span:last-child").textContent = chartMode === "masking"
      ? "Masking amount needs an unmasked baseline at each same probe frequency."
      : "Complete runs at different probe frequencies. Repeat for at least three masker centers to compare them.";
    drawPlot(ui.maskingChart, series, chartMode);
    ui.chartLegend.innerHTML = series.map((item) => {
      const levels = item.maskerLevels || [];
      const levelNote = levels.length ? ` · ${levels.map(dbLabel).join(" / ")}` : "";
      const levelKey = levels.length ? `<i class="legend-masker-level" style="--legend-color:${item.color}" title="Masker level reference"></i>` : "";
      return `<span class="legend-item"><i class="${item.dashed ? "legend-dash" : "legend-dot"}" style="--legend-color:${item.color}"></i>${levelKey}${item.name}${levelNote}${item.hasLive ? " · live" : ""}</span>`;
    }).join("");
    renderLiveCurve();
  }

  function renderLiveCurve() {
    const series = chartData("threshold", true);
    drawPlot(ui.liveMaskingChart, series, "threshold", true);
    if (run) {
      const state = run.isPlaying ? "PLAYING" : run.awaitingResponse ? "RESPOND" : "RUNNING";
      ui.liveCurveState.innerHTML = `<i></i>${state}`;
      ui.liveCurveState.className = "live-state is-active";
      ui.liveCurveCondition.textContent = `${run.baseline ? "No-mask baseline" : `${frequencyText(run.maskerHz)} masker`} · ${frequencyText(run.probeHz)} probe`;
      ui.liveCurveLevel.textContent = dbLabel(run.currentDbfs);
      ui.liveCurveHint.textContent = "Provisional live level; the saved threshold is estimated from reversal levels when the run ends.";
    } else {
      ui.liveCurveState.innerHTML = "<i></i>READY";
      ui.liveCurveState.className = "live-state";
      const latest = measurements[measurements.length - 1];
      ui.liveCurveCondition.textContent = latest
        ? `${latest.condition === "baseline" ? "No-mask baseline" : `${frequencyText(latest.maskerHz)} masker`} · ${frequencyText(latest.probeHz)} probe`
        : "No completed measurements yet";
      ui.liveCurveLevel.textContent = latest ? dbLabel(latest.thresholdDbfs) : "—";
      ui.liveCurveHint.textContent = latest
        ? "Start another run to watch its current probe point move on this curve."
        : "The current probe point appears here when you begin a staircase.";
    }
  }

  function setLiveCurveCollapsed(collapsed) {
    ui.liveCurve.classList.toggle("is-collapsed", collapsed);
    const label = collapsed ? "Open live masking curve" : "Close live masking curve";
    ui.liveCurveToggle.textContent = collapsed ? "+" : "−";
    ui.liveCurveToggle.setAttribute("aria-expanded", String(!collapsed));
    ui.liveCurveToggle.setAttribute("aria-label", label);
    ui.liveCurveToggle.title = label;
  }

  function renderTable() {
    const newestFirst = [...measurements].reverse();
    if (!newestFirst.length) {
      ui.measurementTable.innerHTML = '<div class="table-empty">Finished runs are saved in this browser. Export a visual report with the graph and measurements.</div>';
      return;
    }
    const rows = newestFirst.slice(0, 12).map((item) => `<tr>
      <td><span class="condition-tag ${item.condition === "baseline" ? "baseline" : ""}">${item.condition === "baseline" ? "baseline" : "masked"}</span></td>
      <td>${hzLabel(Number(item.maskerHz))}</td><td>${hzLabel(Number(item.probeHz))}</td><td>${dbLabel(Number(item.thresholdDbfs))}</td>
      <td>${item.trials}</td><td><button class="delete-row" data-delete="${item.id}" aria-label="Delete measurement" title="Delete measurement">×</button></td></tr>`).join("");
    ui.measurementTable.innerHTML = `<table class="measure-table"><thead><tr><th>CONDITION</th><th>MASKER</th><th>PROBE</th><th>THRESHOLD</th><th>TRIALS</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  function renderDashboard() {
    const masked = measurements.filter((item) => item.condition === "masked");
    const baselines = measurements.filter((item) => item.condition === "baseline");
    ui.dataCount.textContent = `${measurements.length} saved measurement${measurements.length === 1 ? "" : "s"} · ${new Set(masked.map((item) => item.maskerHz)).size} masker centers · ${baselines.length} baselines`;
    renderChart();
    renderTable();
  }

  function downloadBlob(filename, blob) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportSeriesLabel(item) {
    const levels = item.maskerLevels || [];
    return `${item.name}${levels.length ? ` · ${levels.map(dbLabel).join(" / ")}` : ""}${item.hasLive ? " · live" : ""}`;
  }

  function createExportSnapshot() {
    const series = chartData(chartMode, false);
    const chartSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    chartSvg.setAttribute("viewBox", "0 0 900 400");
    chartSvg.setAttribute("role", "img");
    chartSvg.setAttribute("aria-label", "Saved frequency masking results");
    drawPlot(chartSvg, series, chartMode);
    if (!series.some((item) => item.points.length)) {
      const emptyText = document.createElementNS("http://www.w3.org/2000/svg", "text");
      emptyText.setAttribute("x", "450");
      emptyText.setAttribute("y", "210");
      emptyText.setAttribute("text-anchor", "middle");
      emptyText.setAttribute("class", "chart-label");
      emptyText.textContent = chartMode === "masking" ? "Matching baseline measurements are needed" : "No completed measurements yet";
      chartSvg.appendChild(emptyText);
    }
    return {
      series,
      chartSvg,
      records: [...measurements].reverse(),
      mode: chartMode,
    };
  }

  function appendReportLegend(container, series) {
    series.forEach((item) => {
      const entry = document.createElement("span");
      entry.className = "export-legend-item";
      const curveKey = document.createElement("i");
      curveKey.className = item.dashed ? "legend-dash" : "legend-dot";
      curveKey.style.setProperty("--legend-color", item.color);
      entry.appendChild(curveKey);
      if ((item.maskerLevels || []).length) {
        const levelKey = document.createElement("i");
        levelKey.className = "legend-masker-level";
        levelKey.style.setProperty("--legend-color", item.color);
        entry.appendChild(levelKey);
      }
      entry.appendChild(document.createTextNode(exportSeriesLabel(item)));
      container.appendChild(entry);
    });
  }

  function appendReportTable(container, records) {
    const columns = [
      { title: "CONDITION", value: (item) => item.condition === "baseline" ? "Baseline" : "Masked" },
      { title: "MASKER", value: (item) => item.condition === "baseline" ? "No mask" : hzLabel(Number(item.maskerHz)) },
      { title: "MASKER LEVEL", value: (item) => item.condition === "baseline" ? "—" : dbLabel(Number(item.maskerLevelDbfs)) },
      { title: "PROBE", value: (item) => hzLabel(Number(item.probeHz)) },
      { title: "THRESHOLD", value: (item) => dbLabel(Number(item.thresholdDbfs)) },
      { title: "TRIALS", value: (item) => String(item.trials ?? "—") },
      { title: "REVERSALS", value: (item) => String(item.reversals ?? "—") },
      { title: "NO DIFFERENCE", value: (item) => String(item.uncertainResponses ?? 0) },
    ];
    const table = document.createElement("table");
    table.className = "export-table";
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    columns.forEach((column) => {
      const th = document.createElement("th");
      th.scope = "col";
      th.textContent = column.title;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);
    const tbody = document.createElement("tbody");
    records.forEach((record) => {
      const row = document.createElement("tr");
      columns.forEach((column) => {
        const cell = document.createElement("td");
        cell.textContent = column.value(record);
        row.appendChild(cell);
      });
      tbody.appendChild(row);
    });
    table.appendChild(tbody);
    container.appendChild(table);
  }

  function populateExportReport(snapshot) {
    const report = ui.exportReport;
    report.replaceChildren();
    report.setAttribute("aria-hidden", "false");

    const title = document.createElement("h1");
    title.textContent = "Frequency Masking Lab";
    const subtitle = document.createElement("p");
    const modeLabel = snapshot.mode === "threshold" ? "Probe threshold" : "Masking amount";
    subtitle.textContent = `${modeLabel} · ${snapshot.records.length} saved measurement${snapshot.records.length === 1 ? "" : "s"} · Levels are dBFS, not calibrated dB SPL. In-progress trials are excluded.`;
    const chartHeading = document.createElement("h2");
    chartHeading.textContent = "Masking curves";
    const chartSvg = snapshot.chartSvg.cloneNode(true);
    chartSvg.classList.add("export-chart");
    const legend = document.createElement("div");
    legend.className = "export-legend";
    appendReportLegend(legend, snapshot.series);
    const measurementsHeading = document.createElement("h2");
    measurementsHeading.className = "export-measurements-heading";
    measurementsHeading.textContent = "Measurements";

    report.append(title, subtitle, chartHeading, chartSvg, legend, measurementsHeading);
    if (snapshot.records.length) appendReportTable(report, snapshot.records);
    else {
      const empty = document.createElement("p");
      empty.className = "export-empty";
      empty.textContent = "No saved measurements yet. Complete a threshold run to populate this report.";
      report.appendChild(empty);
    }
  }

  function exportPdf() {
    const snapshot = createExportSnapshot();
    populateExportReport(snapshot);
    const previousTitle = document.title;
    document.title = "Frequency Masking Lab Results";
    document.body.classList.add("printing-report");
    const cleanup = () => {
      document.body.classList.remove("printing-report");
      ui.exportReport.setAttribute("aria-hidden", "true");
      document.title = previousTitle;
    };
    window.addEventListener("afterprint", cleanup, { once: true });
    window.print();
  }

  function imageFromSvg(svg) {
    const SVG_NS = "http://www.w3.org/2000/svg";
    const clone = svg.cloneNode(true);
    clone.setAttribute("xmlns", SVG_NS);
    clone.setAttribute("width", "1800");
    clone.setAttribute("height", "800");
    const style = document.createElementNS(SVG_NS, "style");
    style.textContent = `.chart-grid{stroke:#eaebe5;stroke-width:1}.chart-axis{stroke:#b9c0b8;stroke-width:1}.chart-label{fill:#7c857d;font:10px ui-monospace,monospace}.chart-label-x{fill:#48544b;font:10px ui-monospace,monospace}.chart-series{fill:none;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}.chart-point{stroke:#fffefa;stroke-width:2}.chart-masker{stroke-width:1.2;stroke-dasharray:4 5;opacity:.7}.chart-masker-level{stroke-width:1.35;stroke-dasharray:2 4;opacity:.82}.chart-live-ring{fill:#fffefa;stroke-width:1.5}.chart-live-point{fill:#202722;stroke:#fffefa;stroke-width:1}`;
    clone.insertBefore(style, clone.firstChild);
    const svgBlob = new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
      image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not render the graph for JPEG export.")); };
      image.src = url;
    });
  }

  async function exportJpeg() {
    ui.exportJpeg.disabled = true;
    try {
      const snapshot = createExportSnapshot();
      const image = await imageFromSvg(snapshot.chartSvg);
      const width = 1800, margin = 72, contentWidth = width - margin * 2;
      const graphHeight = Math.round(contentWidth * (400 / 900));
      const graphTop = 238;
      const legendTop = graphTop + graphHeight + 28;
      const legendRows = Math.ceil(snapshot.series.length / 2);
      const tableHeadingTop = legendTop + legendRows * 34 + 34;
      const tableHeaderTop = tableHeadingTop + 24;
      const rowTop = tableHeaderTop + 42;
      const rowHeight = 40;
      const height = rowTop + Math.max(snapshot.records.length, 1) * rowHeight + margin;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas is unavailable in this browser.");
      context.fillStyle = "#fffefa";
      context.fillRect(0, 0, width, height);
      context.fillStyle = "#202722";
      context.font = "600 42px Arial, sans-serif";
      context.fillText("Frequency Masking Lab", margin, 92);
      context.fillStyle = "#667168";
      context.font = "18px Arial, sans-serif";
      const modeLabel = snapshot.mode === "threshold" ? "Probe threshold" : "Masking amount";
      context.fillText(`${modeLabel} · ${snapshot.records.length} saved measurements · Levels are dBFS, not calibrated dB SPL. In-progress trials are excluded.`, margin, 135, contentWidth);
      context.fillStyle = "#202722";
      context.font = "600 25px Arial, sans-serif";
      context.fillText("Masking curves", margin, 208);
      context.drawImage(image, margin, graphTop, contentWidth, graphHeight);

      snapshot.series.forEach((item, index) => {
        const column = index % 2;
        const row = Math.floor(index / 2);
        const x = margin + column * (contentWidth / 2);
        const y = legendTop + row * 34;
        context.beginPath();
        context.fillStyle = item.color;
        context.arc(x + 7, y - 5, 6, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = "#455147";
        context.font = "16px Arial, sans-serif";
        context.fillText(exportSeriesLabel(item), x + 22, y, contentWidth / 2 - 28);
      });

      context.fillStyle = "#202722";
      context.font = "600 25px Arial, sans-serif";
      context.fillText(`Measurements (${snapshot.records.length})`, margin, tableHeadingTop);
      const columns = [
        { title: "CONDITION", ratio: 0.12, value: (item) => item.condition === "baseline" ? "Baseline" : "Masked" },
        { title: "MASKER", ratio: 0.13, value: (item) => item.condition === "baseline" ? "No mask" : hzLabel(Number(item.maskerHz)) },
        { title: "MASKER LEVEL", ratio: 0.15, value: (item) => item.condition === "baseline" ? "—" : dbLabel(Number(item.maskerLevelDbfs)) },
        { title: "PROBE", ratio: 0.13, value: (item) => hzLabel(Number(item.probeHz)) },
        { title: "THRESHOLD", ratio: 0.14, value: (item) => dbLabel(Number(item.thresholdDbfs)) },
        { title: "TRIALS", ratio: 0.08, value: (item) => String(item.trials ?? "—") },
        { title: "REVERSALS", ratio: 0.10, value: (item) => String(item.reversals ?? "—") },
        { title: "NO DIFFERENCE", ratio: 0.15, value: (item) => String(item.uncertainResponses ?? 0) },
      ];
      const columnWidths = columns.map((column) => contentWidth * column.ratio);
      context.fillStyle = "#edf2ec";
      context.fillRect(margin, tableHeaderTop, contentWidth, 42);
      let columnX = margin;
      columns.forEach((column, index) => {
        context.fillStyle = "#526057";
        context.font = "600 13px Arial, sans-serif";
        context.fillText(column.title, columnX + 10, tableHeaderTop + 26, columnWidths[index] - 18);
        columnX += columnWidths[index];
      });
      if (!snapshot.records.length) {
        context.fillStyle = "#788179";
        context.font = "17px Arial, sans-serif";
        context.fillText("No saved measurements yet. Complete a threshold run to populate this report.", margin, rowTop + 24);
      } else {
        snapshot.records.forEach((record, rowIndex) => {
          const y = rowTop + rowIndex * rowHeight;
          context.fillStyle = rowIndex % 2 ? "#f7f8f5" : "#ffffff";
          context.fillRect(margin, y, contentWidth, rowHeight);
          context.strokeStyle = "#e6e9e3";
          context.beginPath();
          context.moveTo(margin, y + rowHeight);
          context.lineTo(margin + contentWidth, y + rowHeight);
          context.stroke();
          let x = margin;
          columns.forEach((column, columnIndex) => {
            context.fillStyle = "#455047";
            context.font = "15px Arial, sans-serif";
            context.fillText(column.value(record), x + 10, y + 25, columnWidths[columnIndex] - 18);
            x += columnWidths[columnIndex];
          });
        });
      }
      const jpeg = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.94));
      if (!jpeg) throw new Error("Could not create a JPEG in this browser.");
      downloadBlob("frequency-masking-report.jpg", jpeg);
    } catch (error) {
      window.alert(error.message || "Could not export the JPEG report.");
    } finally {
      ui.exportJpeg.disabled = false;
    }
  }

  ui.maskerFrequency.addEventListener("change", () => populateProbeFrequencies());
  ui.maskerLevel.addEventListener("input", renderSetupValues);
  ui.probeStart.addEventListener("input", renderSetupValues);
  ui.baselineMode.addEventListener("change", renderSetupValues);
  ui.startRun.addEventListener("click", beginRun);
  ui.playTrial.addEventListener("click", playBothIntervals);
  ui.choices.forEach((button) => button.addEventListener("click", () => answerTrial(button.dataset.choice)));
  ui.stopRun.addEventListener("click", () => finishRun("stopped", true));
  ui.thresholdMode.addEventListener("click", () => { chartMode = "threshold"; ui.thresholdMode.classList.add("is-active"); ui.maskingMode.classList.remove("is-active"); renderChart(); });
  ui.maskingMode.addEventListener("click", () => { chartMode = "masking"; ui.maskingMode.classList.add("is-active"); ui.thresholdMode.classList.remove("is-active"); renderChart(); });
  ui.exportPdf.addEventListener("click", exportPdf);
  ui.exportJpeg.addEventListener("click", exportJpeg);
  ui.clearData.addEventListener("click", resetAllData);
  ui.liveCurveToggle.addEventListener("click", () => setLiveCurveCollapsed(!ui.liveCurve.classList.contains("is-collapsed")));
  ui.measurementTable.addEventListener("click", (event) => {
    const button = event.target.closest("[data-delete]");
    if (!button) return;
    measurements = measurements.filter((item) => item.id !== button.dataset.delete);
    storeMeasurements();
    renderDashboard();
  });
  document.addEventListener("keydown", (event) => {
    if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
    if ((event.key === "1" || event.key === "2") && run && run.awaitingResponse) answerTrial(event.key);
    if (event.key === "3" && run && run.awaitingResponse) answerTrial("uncertain");
  });
  window.addEventListener("resize", () => renderChart());

  populateProbeFrequencies();
  renderSetupValues();
  renderDashboard();
})();
