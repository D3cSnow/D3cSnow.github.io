/* Elixir — the plan.
   ---------------------------------------------------------------------------
   Dates, phases, the rotating topic cycle and the daily template. This is the
   only file that needs editing when the term dates change or the course list
   turns out different from anatomy / histology / embryology / physiology.

   The strategy behind all of it is in Roadmap.md.
   --------------------------------------------------------------------------- */
window.Elixir = window.Elixir || {};

Elixir.plan = (function () {
  "use strict";

  var state = Elixir.state;

  /* Source: NTU 115 學年度行事曆. */
  var CALENDAR = {
    termStart: "2026-09-07",
    addDrop:   "2026-09-21",
    midStart:  "2026-10-26",
    midEnd:    "2026-10-30",
    teachEnd:  "2026-12-18",
    finStart:  "2026-12-21",
    finEnd:    "2026-12-25"
  };

  var RUNWAY_START = "2026-07-14";   // day 0 of the topic cycle

  var PHASES = [
    { id: "setup",  name: "Phase 0 · Setup",           from: "2026-07-11", to: "2026-07-13",
      desc: "Calibrate the system and take an honest baseline." },
    { id: "runway", name: "Phase 1 · Summer runway",   from: "2026-07-14", to: "2026-09-06",
      desc: "Pre-teach the core so lectures become review, not first contact." },
    { id: "term1",  name: "Phase 2 · Term, pre-midterm", from: "2026-09-07", to: "2026-10-25",
      desc: "Keep pace with lectures. Never fall behind." },
    { id: "mid",    name: "Phase 3 · Midterms",        from: "2026-10-26", to: "2026-10-30",
      desc: "Peak recall. Timed 考古 papers." },
    { id: "term2",  name: "Phase 4 · Term, pre-final", from: "2026-10-31", to: "2026-12-18",
      desc: "Second-half systems plus rolling review of everything prior." },
    { id: "finals", name: "Phase 5 · Finals",          from: "2026-12-19", to: "2026-12-25",
      desc: "Synthesis only. Trust the queue you have fed for five months." },
    { id: "break",  name: "Winter break",              from: "2026-12-26", to: "2027-02-19",
      desc: "Consolidate, get ahead, turn the AI track into something citable." }
  ];

  function daysTo(dateStr) {
    return state.dayNumber(dateStr) - state.today0();
  }

  function currentPhase() {
    var t = state.today0();
    for (var i = 0; i < PHASES.length; i++) {
      if (t >= state.dayNumber(PHASES[i].from) && t <= state.dayNumber(PHASES[i].to)) return PHASES[i];
    }
    return t < state.dayNumber(PHASES[0].from) ? PHASES[0] : PHASES[PHASES.length - 1];
  }

  /* Two twenty-day cycles that advance one step per day and wrap. Anatomy
     anchors each medical topic; histology, embryology and physiology of the
     same system ride along with it. */
  var MED_TOPICS = [
    "Upper limb — bones, brachial plexus, axilla",
    "Upper limb — arm/forearm/hand + muscle histology",
    "Thorax wall & breast + Physio: cardiac cycle",
    "Heart anatomy + Embryo: heart tube & septation",
    "Lungs & mediastinum + Physio: pulmonary mechanics",
    "Respiratory histology + Physio: gas exchange & O₂–Hb curve",
    "Abdominal wall & inguinal canal + Embryo: gut rotation",
    "Foregut GI anatomy + Histo: GI wall layers",
    "Mid/hindgut + Physio: GI secretion & motility",
    "Liver, biliary tree, pancreas + Histo: liver lobule",
    "Kidneys & retroperitoneum + Physio: GFR & tubular transport",
    "Nephron histology + Physio: countercurrent & ADH",
    "Pelvis & perineum + Embryo: urogenital development",
    "Lower limb — gluteal, femoral triangle, vessels",
    "Lower limb — leg & foot + Physio: skeletal muscle contraction",
    "Head & neck — skull foramina + cranial nerves",
    "Neuroanatomy: brainstem & tracts + Physio: membrane potentials",
    "Neuroanatomy: cerebrum & blood supply + Histo: nervous tissue",
    "Endocrine anatomy + Physio: hormone axes",
    "Integration: germ layers, neural crest, whole-body review"
  ];

  var AI_TOPICS = [
    "Python/NumPy refresh — image as an array",
    "Linear algebra for vision — convolution as a dot product",
    "Image filtering — kernels, edges (Sobel), blurring",
    "CNN fundamentals — conv, stride, padding, receptive field",
    "Pooling, ReLU, and architectures (LeNet → ResNet)",
    "Training — loss, backprop, SGD/Adam, over/underfitting",
    "Regularization — dropout, batch norm, augmentation",
    "Transfer learning & fine-tuning (ImageNet → medical)",
    "Segmentation — U-Net encoder/decoder + skip connections",
    "Segmentation metrics & losses — Dice, IoU, focal, Tversky",
    "Medical imaging — MRI/CT, HU, T1/T2/FLAIR modalities",
    "BraTS & brain-tumor pipeline (Swin-HAFNet paper)",
    "Attention & Transformers — self-attention, multi-head",
    "ViT & Swin — windowed / shifted attention",
    "Multi-task learning — segmentation + classification",
    "LLM basics — architecture, tokenization, pretraining",
    "LLM — encoder vs decoder, BERT vs GPT, context window",
    "LLM adaptation — fine-tuning, in-context, RAG, LoRA",
    "RL foundations — MDP, reward, policy (beneficial-RL paper)",
    "Integration — read & critique one medical-AI paper"
  ];

  function dayIndex() {
    return state.today0() - state.dayNumber(RUNWAY_START);
  }

  function pick(list) {
    var i = dayIndex();
    return list[((i % list.length) + list.length) % list.length];
  }

  function topicsForToday() {
    return { med: pick(MED_TOPICS), ai: pick(AI_TOPICS) };
  }

  /* The daily template. Exam weeks drop new material entirely and put the AI
     track on maintenance — but never to zero. */
  function scheduleFor(phase, med, ai) {
    if (phase.id === "mid" || phase.id === "finals") {
      return [
        { t: "0:00", side: "both", k: "Warm-up — all due cards",
          d: "Clear the queue. No new material during exam week." },
        { t: "0:30", side: "med",  k: "考古 past-exam block, timed",
          d: med + " — a full paper under the clock, then mark it ruthlessly." },
        { t: "2:00", side: "med",  k: "Fix the misses",
          d: "Every wrong answer becomes a card plus one line on why you missed it." },
        { t: "2:45", side: "ai",   k: "AI maintenance",
          d: "Twenty minutes of recall only (" + ai + "). Keep the thread warm." },
        { t: "3:15", side: "both", k: "Synthesis map",
          d: "Blank-page brain-dump of the highest-yield system, then check it." }
      ];
    }
    return [
      { t: "0:00", side: "both", k: "Active-recall warm-up",
        d: "Twenty minutes — due cards and yesterday's misses, before anything new." },
      { t: "0:20", side: "med",  k: "Med — new material",
        d: med + ". Read the atlas or Guyton section, then draw and label from memory." },
      { t: "1:50", side: "med",  k: "Med — drill and 考古",
        d: "Applied questions and a past-exam set on the same topic. Answers spoken aloud." },
      { t: "2:45", side: "ai",   k: "AI — concept and hands-on",
        d: ai + ". Then implement the smallest working version in a notebook." },
      { t: "4:15", side: "ai",   k: "AI — paper and code",
        d: "Reproduce one figure, or write one function from a target paper." },
      { t: "5:05", side: "both", k: "Synthesis and card-forging",
        d: "Twenty-five minutes — make cards from today, teach back the two hardest ideas." }
    ];
  }

  var ROADMAP = [
    { id: "setup",  when: "Now → Jul 13",        h: "Setup and diagnostic", items: [
      "Baseline drill in every domain — before studying, so the weak spots are honest.",
      "Skim Guyton ch. 1–5 and orient yourself in an anatomy atlas.",
      "Commit in writing to the daily block and the streak."
    ]},
    { id: "runway", when: "Jul 14 → Sep 6",      h: "Summer runway — eight weeks", items: [
      "Weeks 1–2: upper and lower limb anatomy, plus CNN fundamentals.",
      "Weeks 3–4: thorax and abdomen, histology, segmentation (U-Net, Dice/IoU).",
      "Weeks 5–6: kidney and pelvis, cardio/renal/resp physiology, medical imaging.",
      "Weeks 7–8: head, neck and neuroanatomy, embryology, Transformers and LLMs.",
      "Daily: twenty new cards each side, all carried forward by the queue."
    ]},
    { id: "term1",  when: "Sep 7 → Oct 25",      h: "Term, pre-midterm", items: [
      "Every lecture converted to cards within 24 hours. A lecture not carded is a lecture not learned.",
      "Friday is synthesis plus one full 考古 set under time.",
      "Protect the AI block even when the med load spikes."
    ]},
    { id: "mid",    when: "Oct 26 → Oct 30",     h: "Midterms", items: [
      "Timed 考古 papers daily; mark ruthlessly.",
      "Every miss becomes a card and a one-line reason.",
      "AI on maintenance. Sleep is a performance input, not a reward."
    ]},
    { id: "term2",  when: "Oct 31 → Dec 18",     h: "Term, pre-final", items: [
      "Second-half systems plus rolling review of all prior material.",
      "Segment a public BraTS case end to end.",
      "Re-read Swin-HAFNet — this time every block should make sense."
    ]},
    { id: "finals", when: "Dec 19 → Dec 25",     h: "Finals", items: [
      "Full-syllabus synthesis maps; trust the queue.",
      "Two full mock papers per subject.",
      "No new topics in the last 48 hours. Consolidate and sleep."
    ]},
    { id: "break",  when: "After Dec 26",        h: "Winter break", items: [
      "Get ahead on 大三下.",
      "Turn the AI track into a reproducible notebook or a mini-paper."
    ]}
  ];

  return {
    CALENDAR:       CALENDAR,
    PHASES:         PHASES,
    ROADMAP:        ROADMAP,
    MED_TOPICS:     MED_TOPICS,
    AI_TOPICS:      AI_TOPICS,
    daysTo:         daysTo,
    currentPhase:   currentPhase,
    topicsForToday: topicsForToday,
    scheduleFor:    scheduleFor,
    dayIndex:       dayIndex
  };
})();
