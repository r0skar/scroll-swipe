;(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof exports === 'object') {
    module.exports = factory();
  } else {
    root.ScrollSwipe = factory();
  }
}(this, function() {
'use strict';

var VERTICAL = 'VERTICAL';
var HORIZONTAL = 'HORIZONTAL';
var PIXEL_STEP = 10;
var LINE_HEIGHT = 40;
var PAGE_HEIGHT = 800;

var acceptedParams = {
  target: 1,
  scrollSensitivity: 1,
  touchSensitivity: 1,
  trackPadSensitivity: 0.2,
  scrollCb: 1,
  touchCb: 1,
  scrollPreventDefault: 1,
  touchPreventDefault: 1
};

if (typeof module !== 'undefined') {
  module.exports = ScrollSwipe;
}

function ScrollSwipe(opts) {
  var _this = this;

  Object.keys(opts).forEach(function (key) {
    if (acceptedParams[key]) {
      _this[key] = opts[key];
      return;
    }

    throw new Error('unknown options for ScrollSwipe: ' + key);
  });

  if (!opts.target) {
    throw new Error('must provide DOM target element to ScrollSwipe');
  }

  if (!this.scrollSensitivity || this.scrollSensitivity < 0) {
    this.scrollSensitivity = 0;
  }

  if (!this.touchSensitivity || this.touchSensitivity < 0) {
    this.touchSensitivity = 0;
  }

  if (!this.trackPadSensitivity || this.trackPadSensitivity < 0) {
    this.trackPadSensitivity = 0;
  }

  if (this.target.style || this.target.style.touchAction === '') {
    this.target.style.touchAction += 'manipulation';
  }

  this.scrollPending = false;
  this.startTouchEvent = null;
  this.latestTouchEvent = null;
  this.latestTouch = null;

  this.startScrollEvent = null;
  this.latestScrollEvent = null;
  this.latestScroll = null;

  this.intent = 0;
  this.currentDirection = VERTICAL;
  this.touchArr = [];
  this.xArr = [];
  this.yArr = [];
  this.touchArrX = [];
  this.touchArrY = [];
  this.intentMap = {
    'VERTICAL': {
      0: 'UP',
      1: 'DOWN'
    },
    'HORIZONTAL': {
      0: 'LEFT',
      1: 'RIGHT'
    }
  };

  //these should only init if true
  if (this.scrollCb) {
    this.initScroll();
  }

  if (this.touchCb) {
    this.initTouch();
  }

  return this;
}

ScrollSwipe.prototype.listen = function listen() {
  this.flush();
  this.scrollPending = false;
  return this;
};

ScrollSwipe.prototype.onWheel = function onWheel(e) {
  var _this2 = this;

  if (this.scrollPreventDefault && eventIsCancelable(e)) {
    e.preventDefault();
  }

  if (this.scrollPending) {
    return;
  }

  this.startScrollEvent = e;

  var _normalizeWheel = normalizeWheel(e),
      spinY = _normalizeWheel.spinY,
      spinX = _normalizeWheel.spinX,
      pixelY = _normalizeWheel.pixelY,
      pixelX = _normalizeWheel.pixelX;

  if (spinX === 0 || Math.abs(spinX) > this.trackPadSensitivity) {
    this.addXScroll(pixelX);
  }

  if (spinY === 0 || Math.abs(spinY) > this.trackPadSensitivity) {
    this.addYScroll(pixelY);
  }

  this.scrollFulfilled(function (fulfilled, direction, intent) {
    if (!fulfilled) {
      return;
    }

    _this2.lockout();
    _this2.latestScrollEvent = e;

    var result = _this2.buildResult({
      startEvent: _this2.latestScrollEvent,
      lastEvent: _this2.latestScrollEvent,
      direction: direction,
      intent: intent
    });

    _this2.scrollCb(result);
    _this2.undoLockout();
  });
};

ScrollSwipe.prototype.initScroll = function initScroll() {
  this.newOnWheel = this.onWheel.bind(this);

  if (this.target && this.target.addEventListener) {
    this.target.addEventListener('wheel', this.newOnWheel, { passive: true });
  }

  return this;
};

ScrollSwipe.prototype.touchMove = function touchMove(e) {
  if (this.touchPreventDefault && eventIsCancelable(e)) {
    e.preventDefault();
  }

  var changedTouches = e.changedTouches[0];
  var x = changedTouches.clientX;
  var y = changedTouches.clientY;

  this.startTouchEvent = e;
  this.addXTouch(x);
  this.addYTouch(y);
};

ScrollSwipe.prototype.buildResult = function buildResult(_ref) {
  var startEvent = _ref.startEvent,
      lastEvent = _ref.lastEvent,
      direction = _ref.direction,
      intent = _ref.intent;

  return {
    startEvent: startEvent,
    lastEvent: lastEvent,
    direction: direction,
    intent: intent,
    scrollPending: this.scrollPending,
    mappedIntent: this.intentMap[direction][intent]
  };
};

ScrollSwipe.prototype.touchEnd = function touchEnd(e) {
  var _this3 = this;

  this.touchFulfilled(e, function (fulfilled, direction, intent) {
    if (!fulfilled) {
      return;
    }

    var result = _this3.buildResult({
      startEvent: _this3.startTouchEvent,
      lastEvent: _this3.latestTouchEvent,
      direction: direction,
      intent: intent
    });

    _this3.touchCb(result);
  });
};

ScrollSwipe.prototype.initTouch = function initTouch() {
  this.newTouchMove = this.touchMove.bind(this);
  this.newTouchEnd = this.touchEnd.bind(this);

  this.target.addEventListener('touchmove', this.newTouchMove, { passive: true });
  this.target.addEventListener('touchend', this.newTouchEnd, false);

  return this;
};

//touch events
ScrollSwipe.prototype.touchFulfilled = function touchFulfilled(e, cb) {
  if (!e) {
    throw new Error('must provide event to touchFulfilled');
  }

  if (!cb) {
    throw new Error('must provide callback to touchFulfilled');
  }

  var touchSensitivity = this.touchSensitivity,
      touchArrX = this.touchArrX,
      touchArrY = this.touchArrY;


  var bool = touchArrX.length > touchSensitivity && touchArrY.length > touchSensitivity;

  if (!bool) {
    return cb(false, null);
  }

  var changedTouches = e.changedTouches[0];

  var xStart = touchArrX[0];
  var yStart = touchArrY[0];

  var xEnd = changedTouches.clientX;
  var yEnd = changedTouches.clientY;

  var xIntent = xStart < xEnd ? 0 : 1;
  var yIntent = yStart < yEnd ? 0 : 1;

  var direction = VERTICAL;

  //determine vertical or horizontal based on the greatest difference
  if (Math.abs(xStart - xEnd) > Math.abs(yStart - yEnd)) {
    direction = HORIZONTAL;
  }

  var intent = direction === VERTICAL ? yIntent : xIntent;

  swap.call(this, intent, direction);
  this.resetTouches();
  this.scrollPending = true;
  this.latestTouchEvent = e;

  cb(this.scrollPending, this.currentDirection, this.currentIntent);
  return this;
};

ScrollSwipe.prototype.getTouch = function getTouch(idx) {
  return this.touchArr[idx];
};

ScrollSwipe.prototype.addXTouch = function addTouch(touch) {
  if (this.pending()) {
    return this;
  }

  this.latestTouch = touch;
  this.touchArrX.push(touch);

  return this;
};

ScrollSwipe.prototype.addYTouch = function addTouch(touch) {
  if (this.pending()) {
    return this;
  }

  this.latestTouch = touch;
  this.touchArrY.push(touch);

  return this;
};

ScrollSwipe.prototype.resetTouches = function resetTouches() {
  this.touchArrX = [];
  this.touchArrY = [];
  return this;
};

//wheel events
ScrollSwipe.prototype.addXScroll = function addXScroll(s) {
  if (this.pending()) {
    return this;
  }

  this.latestScroll = s;
  this.xArr.push(s);
  return this;
};

ScrollSwipe.prototype.addYScroll = function addYScroll(s) {
  if (this.pending()) {
    return this;
  }

  this.latestScroll = s;
  this.yArr.push(s);
  return this;
};

ScrollSwipe.prototype.getDirection = function getDirection() {
  return this.currentDirection;
};

ScrollSwipe.prototype.resetScroll = function resetScroll() {
  this.xArr = [];
  this.yArr = [];

  return this;
};

ScrollSwipe.prototype.flush = function flush() {
  this.resetScroll();
  this.resetTouches();

  return this;
};

ScrollSwipe.prototype.lockout = function lockout() {
  var noop = function noop() {};

  this.originalAddXTouch = this.addXTouch;
  this.originalAddYTouch = this.addYTouch;

  this.originalAddXScroll = this.addXScroll;
  this.originalAddYScroll = this.addYScroll;

  this.addXScroll = noop;
  this.addYScroll = noop;
  this.addXTouch = noop;
  this.addYTouch = noop;

  return this;
};

ScrollSwipe.prototype.undoLockout = function undoLockout() {
  this.addXScroll = this.originalAddXScroll;
  this.addYScroll = this.originalAddYScroll;
  this.addXTouch = this.originalAddXTouch;
  this.addYTouch = this.originalAddYTouch;

  return this;
};

ScrollSwipe.prototype.scrollFulfilled = function scrollFulfilled(cb) {
  if (!cb) {
    throw new Error('must provide callback to scrollFulfilled');
  }

  var xArr = this.xArr,
      yArr = this.yArr,
      scrollSensitivity = this.scrollSensitivity;

  var bool = xArr.length > scrollSensitivity && yArr.length > scrollSensitivity;

  var _evalScrollDirection = this.evalScrollDirection(),
      direction = _evalScrollDirection.direction,
      intent = _evalScrollDirection.intent;

  if (bool) {
    swap.call(this, intent, direction);
    this.resetScroll();
    this.scrollPending = true;
  }

  cb(this.scrollPending, this.currentDirection, this.currentIntent);
  return this;
};

ScrollSwipe.prototype.evalScrollDirection = function evalScrollDirection() {
  var _getSums = this.getSums(),
      x = _getSums.x,
      y = _getSums.y,
      xIntent = _getSums.xIntent,
      yIntent = _getSums.yIntent;

  var direction = x > y ? HORIZONTAL : VERTICAL;
  var base = direction === VERTICAL ? yIntent : xIntent;

  var intent = 0;

  if (base > 0) {
    intent = 1;
  }

  return { direction: direction, intent: intent };
};

ScrollSwipe.prototype.getSums = function getSums() {
  var xArr = this.xArr,
      yArr = this.yArr;


  var xIntent = 0;
  var yIntent = 0;

  var x = xArr.reduce(function (result, curr) {
    xIntent = xIntent + curr;
    return result += Math.abs(curr);
  }, 0);

  var y = yArr.reduce(function (result, curr) {
    yIntent = yIntent + curr;
    return result += Math.abs(curr);
  }, 0);

  return { x: x, y: y, xIntent: xIntent, yIntent: yIntent };
};

ScrollSwipe.prototype.getScrollDirection = function getScrollDirection() {
  return this.currentDirection;
};

ScrollSwipe.prototype.pending = function pending() {
  return this.scrollPending;
};

ScrollSwipe.prototype.killScroll = function killScroll() {
  if (this.target && this.target.removeEventListener) {
    this.target.removeEventListener('wheel', this.newOnWheel, false);
  }

  return this;
};

ScrollSwipe.prototype.killTouch = function killTouch() {
  if (this.target && this.target.removeEventListener) {
    this.target.removeEventListener('touchmove', this.newTouchMove, false);
    this.target.removeEventListener('touchend', this.newTouchEnd, false);
  }

  return this;
};

ScrollSwipe.prototype.killAll = function teardown() {
  this.killScroll().killTouch();
  this.flush();
  return this;
};

function swap(intent, direction) {
  this.previousIntent = this.currentIntent;
  this.currentIntent = intent;
  this.previousDirection = this.currentDirection;
  this.currentDirection = direction;
}

function eventIsCancelable(event) {
  return typeof event.cancelable !== 'boolean' || event.cancelable;
}

// https://gist.github.com/akella/11574989a9f3cc9e0ad47e401c12ccaf
function normalizeWheel(event) {
  var sX = 0,
      sY = 0,
      // spinX, spinY
  pX = 0,
      pY = 0; // pixelX, pixelY

  // Legacy
  if ('detail' in event) {
    sY = event.detail;
  }

  if ('wheelDelta' in event) {
    sY = -event.wheelDelta / 120;
  }

  if ('wheelDeltaY' in event) {
    sY = -event.wheelDeltaY / 120;
  }

  if ('wheelDeltaX' in event) {
    sX = -event.wheelDeltaX / 120;
  }

  // side scrolling on FF with DOMMouseScroll
  if ('axis' in event && event.axis === event.HORIZONTAL_AXIS) {
    sX = sY;
    sY = 0;
  }

  pX = sX * PIXEL_STEP;
  pY = sY * PIXEL_STEP;

  if ('deltaY' in event) {
    pY = event.deltaY;
  }

  if ('deltaX' in event) {
    pX = event.deltaX;
  }

  if ((pX || pY) && event.deltaMode) {
    if (event.deltaMode == 1) {
      // delta in LINE units
      pX *= LINE_HEIGHT;
      pY *= LINE_HEIGHT;
    } else {
      // delta in PAGE units
      pX *= PAGE_HEIGHT;
      pY *= PAGE_HEIGHT;
    }
  }

  // Fall-back if spin cannot be determined
  if (pX && !sX) {
    sX = pX < 1 ? -1 : 1;
  }

  if (pY && !sY) {
    sY = pY < 1 ? -1 : 1;
  }

  return {
    spinX: sX,
    spinY: sY,
    pixelX: pX,
    pixelY: pY
  };
}
return ScrollSwipe;
}));
