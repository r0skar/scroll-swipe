/* eslint-disable */

interface OriEvent extends CustomEvent {
  path: HTMLElement[]
}

export interface SwipeEvent {
  direction: 'VERTICAL' | 'HORIZONTAL'
  intent: 1 | 0
  lastEvent: OriEvent
  mappedIntent: 'UP' | 'DOWN'
  scrollPending: boolean
  startEvent: OriEvent
}

export interface Options {
  /**
   * The target element.
   */
  target?: HTMLElement

  /**
   * Min. distance in pixels before scroll event is added to queue.
   */
  trackPadSensitivity?: number

  /**
   * The lower the number, the more sensitive.
   */
  scrollSensitivity?: number

  /**
   * The lower the number, the more sensitive.
   */
  touchSensitivity?: number

  /**
   * Prevents default option for scroll events, manually handle scrolls with scrollCb.
   */
  scrollPreventDefault?: boolean

  /**
   * Prevents default option for touch events, manually handle scrolls with touchCb
   */
  touchPreventDefault?: boolean

  /**
   * Callback function called upon mousewheel scroll.
   */
  scrollCb?: (event: SwipeEvent) => void

  /**
   * Callback function called upon touchmove.
   */
  touchCb?: (event: SwipeEvent) => void
}

/**
 * Swipe handler to listen for swipes and scroll events.
 * @see https://github.com/cmswalker/scroll-swipe/
 */
class ScrollSwipe {
  constructor(opts: Options)

  /**
   * Sets `scrollPending` back to `false` to listen for the next event.
   */
  listen: () => void

  /**
   * Removes all event listeners.
   */
  killAll: () => void

}

export default ScrollSwipe
