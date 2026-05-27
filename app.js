
(function () {
  "use strict";

  var QUESTIONS = window.QUIZ_QUESTIONS_151_200 || [];
  var TOTAL = QUESTIONS.length;
  var STORAGE_KEY = "aws_saa_c03_quiz_q151_200_new_page_v1";
  var tick = null;
  var state = null;

  function byId(id) { return document.getElementById(id); }

  var els = {};

  function initElements() {
    [
      "diagnostic", "introCard", "quizArea", "pausedCard", "resultsCard",
      "startBtn", "newFromIntroBtn", "pauseTopBtn", "pauseBtn", "resumeBtn",
      "newTestPausedBtn", "restartBtn", "prevBtn", "submitBtn", "nextBtn",
      "questionText", "options", "feedback", "randomPosition", "pdfQuestionNumber",
      "multiHint", "statProgress", "statScore", "statWrong", "statTime",
      "progressBar", "finalScore", "finalPercent", "finalWrong", "finalTime",
      "reviewBtn", "reviewArea"
    ].forEach(function (id) { els[id] = byId(id); });
  }

  function storageAvailable() {
    try {
      var test = "__quiz_storage_test__";
      window.localStorage.setItem(test, test);
      window.localStorage.removeItem(test);
      return true;
    } catch (e) {
      return false;
    }
  }

  var canStore = storageAvailable();

  function shuffle(arr) {
    var copy = arr.slice();
    for (var i = copy.length - 1; i > 0; i -= 1) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  function makeOrder() {
    var all = [];
    for (var i = 0; i < TOTAL; i += 1) all.push(i);
    return shuffle(all);
  }

  function makeOptionOrders(order) {
    var optionOrders = {};
    order.forEach(function (qIndex) {
      var q = QUESTIONS[qIndex];
      optionOrders[String(q.id)] = shuffle(q.options.map(function (opt) { return opt.letter; }));
    });
    return optionOrders;
  }

  function freshState() {
    var order = makeOrder();
    return {
      total: TOTAL,
      order: order,
      optionOrders: makeOptionOrders(order),
      index: 0,
      selected: {},
      submitted: {},
      correct: {},
      paused: false,
      finished: false,
      elapsedSeconds: 0,
      lastStartedAt: null,
      createdAt: Date.now()
    };
  }

  function validLoadedState(parsed) {
    if (!parsed || parsed.total !== TOTAL) return false;
    if (!Array.isArray(parsed.order) || parsed.order.length !== TOTAL) return false;
    for (var i = 0; i < parsed.order.length; i += 1) {
      var qIndex = parsed.order[i];
      if (typeof qIndex !== "number" || qIndex < 0 || qIndex >= TOTAL) return false;
    }
    return true;
  }

  function repairState(s) {
    s.optionOrders = s.optionOrders || {};
    s.order.forEach(function (qIndex) {
      var q = QUESTIONS[qIndex];
      var key = String(q.id);
      var validLetters = q.options.map(function (opt) { return opt.letter; }).sort().join("|");
      var existing = Array.isArray(s.optionOrders[key]) ? s.optionOrders[key].slice().sort().join("|") : "";
      if (existing !== validLetters) {
        s.optionOrders[key] = shuffle(q.options.map(function (opt) { return opt.letter; }));
      }
    });
    if (typeof s.index !== "number" || s.index < 0 || s.index >= TOTAL) s.index = 0;
    s.selected = s.selected || {};
    s.submitted = s.submitted || {};
    s.correct = s.correct || {};
    s.paused = !!s.paused;
    s.finished = !!s.finished;
    s.elapsedSeconds = s.elapsedSeconds || 0;
    s.lastStartedAt = null;
    return s;
  }

  function loadState() {
    if (!canStore) return null;
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!validLoadedState(parsed)) return null;
      return repairState(parsed);
    } catch (e) {
      return null;
    }
  }

  function saveState() {
    if (!canStore || !state) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {}
  }

  function show(view) {
    els.introCard.classList.toggle("hidden", view !== "intro");
    els.quizArea.classList.toggle("hidden", view !== "quiz");
    els.pausedCard.classList.toggle("hidden", view !== "paused");
    els.resultsCard.classList.toggle("hidden", view !== "results");
    els.pauseTopBtn.disabled = view !== "quiz";
  }

  function stopTimer() {
    if (tick) window.clearInterval(tick);
    tick = null;

    if (state && state.lastStartedAt && !state.paused && !state.finished) {
      var diff = Math.floor((Date.now() - state.lastStartedAt) / 1000);
      if (diff > 0) state.elapsedSeconds += diff;
    }
    if (state) state.lastStartedAt = null;
    saveState();
  }

  function startTimer() {
    stopTimer();
    if (!state.paused && !state.finished) {
      state.lastStartedAt = Date.now();
      saveState();
      tick = window.setInterval(updateStats, 1000);
    }
  }

  function getElapsedSeconds() {
    var total = state.elapsedSeconds || 0;
    if (state.lastStartedAt && !state.paused && !state.finished) {
      total += Math.floor((Date.now() - state.lastStartedAt) / 1000);
    }
    return total;
  }

  function formatTime(seconds) {
    seconds = Number(seconds) || 0;
    var h = Math.floor(seconds / 3600);
    var m = Math.floor((seconds % 3600) / 60);
    var s = seconds % 60;
    function pad(n) { return String(n).padStart(2, "0"); }
    if (h > 0) return pad(h) + ":" + pad(m) + ":" + pad(s);
    return pad(m) + ":" + pad(s);
  }

  function currentQuestion() {
    return QUESTIONS[state.order[state.index]];
  }

  function optionsForQuestion(q) {
    var letters = state.optionOrders[String(q.id)] || q.options.map(function (opt) { return opt.letter; });
    return letters.map(function (letter) {
      return q.options.find(function (opt) { return opt.letter === letter; });
    }).filter(Boolean);
  }

  function selectedFor(qid) {
    return state.selected[String(qid)] || [];
  }

  function isSubmitted(qid) {
    return !!state.submitted[String(qid)];
  }

  function sameSet(a, b) {
    return a.slice().sort().join("|") === b.slice().sort().join("|");
  }

  function answerText(q, letters) {
    var lines = [];
    letters.forEach(function (letter) {
      var found = q.options.find(function (opt) { return opt.letter === letter; });
      lines.push(found ? letter + ". " + found.text : letter);
    });
    return lines.join("\n");
  }

  function countAnswered() {
    return Object.keys(state.submitted).length;
  }

  function countCorrect() {
    var total = 0;
    Object.keys(state.correct).forEach(function (key) {
      if (state.correct[key]) total += 1;
    });
    return total;
  }

  function renderQuestion() {
    var q = currentQuestion();
    if (!q) {
      els.questionText.textContent = "Question data could not be loaded.";
      return;
    }

    var selected = selectedFor(q.id);
    var submitted = isSubmitted(q.id);

    els.randomPosition.textContent = "Random position " + (state.index + 1) + " of " + TOTAL;
    els.pdfQuestionNumber.textContent = "PDF Question #" + q.id;
    els.questionText.textContent = q.prompt;
    els.multiHint.classList.toggle("hidden", !q.multi);
    els.options.innerHTML = "";

    optionsForQuestion(q).forEach(function (opt) {
      var btn = document.createElement("button");
      btn.className = "option-btn";
      btn.type = "button";
      btn.setAttribute("data-letter", opt.letter);

      var letterSpan = document.createElement("span");
      letterSpan.className = "letter";
      letterSpan.textContent = opt.letter;

      var textSpan = document.createElement("span");
      textSpan.textContent = opt.text;

      btn.appendChild(letterSpan);
      btn.appendChild(textSpan);

      if (selected.indexOf(opt.letter) !== -1) btn.classList.add("selected");
      if (submitted) {
        if (q.correct.indexOf(opt.letter) !== -1) btn.classList.add("correct");
        if (selected.indexOf(opt.letter) !== -1 && q.correct.indexOf(opt.letter) === -1) btn.classList.add("wrong");
      }

      btn.addEventListener("click", function () {
        selectOption(q, opt.letter);
      });

      els.options.appendChild(btn);
    });

    if (submitted) {
      var wasCorrect = !!state.correct[String(q.id)];
      els.feedback.className = "feedback show " + (wasCorrect ? "good" : "bad");
      if (wasCorrect) {
        els.feedback.textContent = "Correct. Answer: " + q.correct.join(", ") + "\n" + answerText(q, q.correct);
      } else {
        els.feedback.textContent =
          "Wrong. Your answer: " + (selected.length ? selected.join(", ") : "No answer") +
          "\n\nCorrect answer: " + q.correct.join(", ") + "\n" + answerText(q, q.correct);
      }
      els.submitBtn.classList.add("hidden");
      els.nextBtn.classList.remove("hidden");
      els.nextBtn.textContent = state.index === TOTAL - 1 ? "Finish Test" : "Next";
    } else {
      els.feedback.className = "feedback";
      els.feedback.textContent = "";
      els.submitBtn.classList.remove("hidden");
      els.nextBtn.classList.add("hidden");
    }

    els.prevBtn.disabled = state.index === 0;
    updateStats();
    saveState();
  }

  function selectOption(q, letter) {
    if (isSubmitted(q.id)) return;

    var key = String(q.id);
    var selected = selectedFor(q.id).slice();

    if (q.multi) {
      var pos = selected.indexOf(letter);
      if (pos !== -1) selected.splice(pos, 1);
      else selected.push(letter);
    } else {
      selected = [letter];
    }

    state.selected[key] = selected;
    saveState();
    renderQuestion();
  }

  function submitAnswer() {
    var q = currentQuestion();
    var selected = selectedFor(q.id);

    if (selected.length === 0) {
      els.feedback.className = "feedback show bad";
      els.feedback.textContent = "Please choose an answer first.";
      return;
    }

    var ok = sameSet(selected, q.correct);
    state.submitted[String(q.id)] = true;
    state.correct[String(q.id)] = ok;
    saveState();
    renderQuestion();
  }

  function nextQuestion() {
    if (state.index < TOTAL - 1) {
      state.index += 1;
      saveState();
      renderQuestion();
      window.scrollTo(0, 0);
    } else {
      finishQuiz();
    }
  }

  function prevQuestion() {
    if (state.index > 0) {
      state.index -= 1;
      saveState();
      renderQuestion();
      window.scrollTo(0, 0);
    }
  }

  function updateStats() {
    var answered = countAnswered();
    var correct = countCorrect();
    var wrong = answered - correct;

    els.statProgress.textContent = answered + "/" + TOTAL;
    els.statScore.textContent = correct;
    els.statWrong.textContent = wrong;
    els.statTime.textContent = formatTime(getElapsedSeconds());
    els.progressBar.style.width = Math.round((answered / TOTAL) * 100) + "%";
  }

  function startOrResume() {
    if (!QUESTIONS.length) {
      els.diagnostic.classList.remove("hidden");
      els.diagnostic.textContent = "Question data did not load. Make sure the questions JS file is in the same folder as this HTML page.";
      return;
    }
    if (state.finished) {
      showResultsFromState();
      return;
    }
    if (state.paused) {
      show("paused");
      return;
    }
    show("quiz");
    renderQuestion();
    startTimer();
  }

  function pauseQuiz() {
    stopTimer();
    state.paused = true;
    saveState();
    show("paused");
  }

  function resumeQuiz() {
    state.paused = false;
    state.finished = false;
    saveState();
    show("quiz");
    renderQuestion();
    startTimer();
  }

  function startNewTest() {
    stopTimer();
    state = freshState();
    saveState();
    els.reviewArea.classList.add("hidden");
    show("quiz");
    renderQuestion();
    startTimer();
    window.scrollTo(0, 0);
  }

  function showResultsFromState() {
    stopTimer();
    var correct = countCorrect();
    var answered = countAnswered();
    var wrong = answered - correct;

    els.finalScore.textContent = correct + "/" + TOTAL;
    els.finalPercent.textContent = Math.round((correct / TOTAL) * 100) + "%";
    els.finalWrong.textContent = wrong;
    els.finalTime.textContent = formatTime(getElapsedSeconds());
    show("results");
    renderReview(false);
  }

  function finishQuiz() {
    stopTimer();
    state.finished = true;
    state.paused = false;
    saveState();
    showResultsFromState();
  }

  function escapeHTML(str) {
    return String(str).replace(/[&<>'"]/g, function (ch) {
      return {"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[ch];
    });
  }

  function renderReview(toggleVisibility) {
    if (toggleVisibility === undefined) toggleVisibility = true;

    var correctCount = countCorrect();
    els.reviewArea.innerHTML =
      "<h3>Review</h3><p class=\"small\">Score: " + correctCount + "/" + TOTAL +
      ". Questions are shown in your random order.</p>";

    for (var i = 0; i < state.order.length; i += 1) {
      var q = QUESTIONS[state.order[i]];
      var selected = selectedFor(q.id);
      var ok = !!state.correct[String(q.id)];
      var div = document.createElement("div");
      div.className = "review-item " + (ok ? "correct" : "wrong");
      var selectedLabel = selected.length ? selected.join(", ") : "No answer";

      div.innerHTML =
        "<div class=\"small\">Random position " + (i + 1) + " of " + TOTAL + " | PDF Question #" + q.id + "</div>" +
        "<div class=\"review-q\">" + escapeHTML(q.prompt) + "</div>" +
        "<p><span class=\"answer-pill\">Your: " + escapeHTML(selectedLabel) + "</span> " +
        "<span class=\"answer-pill\">Correct: " + escapeHTML(q.correct.join(", ")) + "</span></p>" +
        "<pre class=\"small\">" + escapeHTML(answerText(q, q.correct)) + "</pre>";

      els.reviewArea.appendChild(div);
    }

    if (toggleVisibility) els.reviewArea.classList.toggle("hidden");
  }

  function addHandlers() {
    els.startBtn.addEventListener("click", startOrResume);
    els.newFromIntroBtn.addEventListener("click", startNewTest);
    els.pauseTopBtn.addEventListener("click", pauseQuiz);
    els.pauseBtn.addEventListener("click", pauseQuiz);
    els.resumeBtn.addEventListener("click", resumeQuiz);
    els.newTestPausedBtn.addEventListener("click", startNewTest);
    els.restartBtn.addEventListener("click", startNewTest);
    els.prevBtn.addEventListener("click", prevQuestion);
    els.submitBtn.addEventListener("click", submitAnswer);
    els.nextBtn.addEventListener("click", nextQuestion);
    els.reviewBtn.addEventListener("click", function () { renderReview(true); });

    window.addEventListener("beforeunload", function () {
      stopTimer();
      saveState();
    });
  }

  function boot() {
    initElements();

    if (TOTAL !== 50) {
      els.diagnostic.classList.remove("hidden");
      els.diagnostic.textContent = "Question data problem: expected 50 questions, found " + TOTAL + ".";
      return;
    }

    state = loadState() || freshState();

    els.diagnostic.classList.add("hidden");
    els.diagnostic.textContent = "JavaScript loaded successfully.";

    if (!canStore) {
      els.diagnostic.classList.remove("hidden");
      els.diagnostic.textContent = "Quiz loaded, but this browser is blocking saved progress. Open the GitHub Pages website link in Safari or Chrome for resume after restart.";
    }

    addHandlers();

    if (state.finished) {
      showResultsFromState();
    } else if (state.paused) {
      show("paused");
    } else {
      show("intro");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
