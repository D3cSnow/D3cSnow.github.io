/* Elixir — Leitner spaced repetition.
   ---------------------------------------------------------------------------
   Six boxes. A card answered correctly moves up one box and comes back later;
   "easy" jumps two; a miss drops it straight back to box 1 and returns it
   tomorrow. Intervals roughly double, which is enough structure to carry
   material from July through to December without a full SM-2 implementation.

   Every function here takes a question ID, never an array index.
   --------------------------------------------------------------------------- */
window.Elixir = window.Elixir || {};

Elixir.scheduler = (function () {
  "use strict";

  var state = Elixir.state;

  /* Days until a card in box N comes back. Box 0 means "never seen". */
  var BOX_DAYS = [0, 1, 2, 4, 9, 17];
  var MAX_BOX  = BOX_DAYS.length - 1;

  var GRADE = { MISSED: 0, GOOD: 1, EASY: 2 };

  function boxOf(id) {
    var c = state.data.sr[id];
    return (c && c.box) || 0;
  }

  function grade(id, g) {
    var box = boxOf(id);
    if (g === GRADE.MISSED)   box = 1;
    else if (g === GRADE.GOOD) box = Math.min(box + 1, MAX_BOX);
    else                       box = Math.min(box + 2, MAX_BOX);

    state.data.sr[id] = { box: box, due: state.today0() + BOX_DAYS[box] };
    state.save();
    return box;
  }

  /* A question counts as due when it has been scheduled and its due day has
     arrived. Unseen questions are "new", not "due" — they are a separate queue
     so a big bank never buries the day's actual review load. */
  function due(bank) {
    var t = state.today0();
    return bank.filter(function (q) {
      var c = state.data.sr[q.id];
      return c && c.due <= t;
    }).map(function (q) { return q.id; });
  }

  function unseen(bank) {
    return bank.filter(function (q) {
      return !state.data.sr[q.id];
    }).map(function (q) { return q.id; });
  }

  function boxCounts() {
    var counts = new Array(MAX_BOX + 1).fill(0);
    Object.keys(state.data.sr).forEach(function (id) {
      var b = state.data.sr[id].box || 0;
      if (b >= 0 && b <= MAX_BOX) counts[b]++;
    });
    return counts;
  }

  function matureCount() {
    return Object.keys(state.data.sr).filter(function (id) {
      return (state.data.sr[id].box || 0) >= 4;
    }).length;
  }

  return {
    GRADE:       GRADE,
    BOX_DAYS:    BOX_DAYS,
    MAX_BOX:     MAX_BOX,
    boxOf:       boxOf,
    grade:       grade,
    due:         due,
    unseen:      unseen,
    boxCounts:   boxCounts,
    matureCount: matureCount
  };
})();
