type SavedStyle = Record<
  "transform" | "transition" | "will-change",
  { value: string; priority: string }
>;
interface Gesture {
  id: number;
  x: number;
  y: number;
  dx: number;
  started: number;
  locked: boolean;
  card: HTMLElement;
  saved: SavedStyle | null;
}
(() => {
  "use strict";
  const bindings = new WeakMap<HTMLElement, Cleanup>();

  function bind(target: HTMLElement | null, options: StoryOptions = {}) {
    if (!target) return () => {};
    const stage = target;
    bindings.get(stage)?.();
    const originalTouchAction = stage.style.touchAction;
    const originalUserSelect = stage.style.userSelect;
    stage.style.touchAction = "pan-y";
    let gesture: Gesture | null = null,
      suppressUntil = 0,
      settleTimer: number | undefined,
      settling: Gesture | null = null;
    const reduced = () =>
      typeof options.reduced === "function"
        ? options.reduced()
        : !!options.reduced;
    const styleKeys = ["transform", "transition", "will-change"] as const;

    function restore(card: HTMLElement | null, saved: SavedStyle | null) {
      if (!card || !saved) return;
      for (const key of styleKeys) {
        const value = saved[key];
        if (value.value)
          card.style.setProperty(key, value.value, value.priority);
        else card.style.removeProperty(key);
      }
    }
    function finishSettling() {
      clearTimeout(settleTimer);
      if (settling) restore(settling.card, settling.saved);
      settling = null;
    }

    function reset(animate = false) {
      const current = gesture;
      gesture = null;
      stage.style.userSelect = originalUserSelect;
      if (!current) return;
      try {
        if (stage.hasPointerCapture(current.id))
          stage.releasePointerCapture(current.id);
      } catch {}
      if (!current.saved) return;
      if (animate && !reduced() && current.card.isConnected) {
        current.card.style.setProperty(
          "transition",
          "transform 220ms cubic-bezier(.2,.8,.2,1)",
        );
        const transform = current.saved.transform;
        if (transform.value)
          current.card.style.setProperty(
            "transform",
            transform.value,
            transform.priority,
          );
        else current.card.style.removeProperty("transform");
        finishSettling();
        settling = current;
        settleTimer = setTimeout(finishSettling, 230);
      } else restore(current.card, current.saved);
    }

    function down(event: PointerEvent) {
      if (
        event.isPrimary === false ||
        (event.pointerType === "mouse" && event.button !== 0)
      )
        return;
      if (
        (event.target as Element | null)?.closest(
          '.story-heart, input, textarea, select, [contenteditable="true"]',
        )
      )
        return;
      finishSettling();
      reset();
      const cards = stage.querySelectorAll<HTMLElement>(
        ".story-card:not(.card-out)",
      );
      const card = cards[cards.length - 1];
      if (!card) return;
      gesture = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        dx: 0,
        started: performance.now(),
        locked: false,
        card,
        saved: null,
      };
    }

    function move(event: PointerEvent) {
      const current = gesture;
      if (!current || event.pointerId !== current.id) return;
      const dx = event.clientX - current.x,
        dy = event.clientY - current.y;
      if (!current.locked) {
        if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
          reset();
          return;
        }
        if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
        current.locked = true;
        current.saved = Object.fromEntries(
          styleKeys.map((key) => [
            key,
            {
              value: current.card.style.getPropertyValue(key),
              priority: current.card.style.getPropertyPriority(key),
            },
          ]),
        ) as SavedStyle;
        try {
          stage.setPointerCapture(current.id);
        } catch {}
        stage.style.userSelect = "none";
      }
      current.dx = dx;
      if (event.cancelable) event.preventDefault();
      if (!reduced()) {
        const travel =
          Math.sign(dx) *
          Math.min(Math.abs(dx) * 0.68, stage.clientWidth * 0.6);
        current.card.style.setProperty("transition", "none");
        current.card.style.setProperty("will-change", "transform");
        current.card.style.setProperty(
          "transform",
          `translateX(${travel}px) rotate(${Math.max(-7, Math.min(7, dx * 0.022))}deg)`,
        );
      }
    }

    function up(event: PointerEvent) {
      const current = gesture;
      if (!current || event.pointerId !== current.id) return;
      const distance = Math.abs(current.dx);
      const threshold = Math.max(42, Math.min(90, stage.clientWidth * 0.16));
      const velocity =
        distance / Math.max(1, performance.now() - current.started);
      const swipe =
        current.locked &&
        (distance >= threshold || (distance > 26 && velocity > 0.6));
      if (current.locked) suppressUntil = performance.now() + 500;
      const direction = current.dx < 0 ? "left" : "right";
      reset(!swipe);
      if (swipe) options.onSwipe?.(direction);
    }

    function cancel(event: PointerEvent) {
      if (gesture?.id === event.pointerId) reset(true);
    }
    function lostCapture(event: PointerEvent) {
      // Touch starts with implicit capture on the card's button. Transferring it
      // to the stage emits a bubbling lostpointercapture from that button.
      // Only loss of the stage's own capture should cancel the swipe.
      if (event.target === stage && !stage.hasPointerCapture(event.pointerId))
        cancel(event);
    }
    function click(event: MouseEvent) {
      if (performance.now() < suppressUntil) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }
    const drag = (event: DragEvent) => event.preventDefault();
    stage.addEventListener("pointerdown", down);
    stage.addEventListener("pointermove", move, { passive: false });
    stage.addEventListener("pointerup", up);
    stage.addEventListener("pointercancel", cancel);
    stage.addEventListener("lostpointercapture", lostCapture);
    stage.addEventListener("click", click, true);
    stage.addEventListener("dragstart", drag);

    function cleanup() {
      reset();
      finishSettling();
      stage.style.touchAction = originalTouchAction;
      stage.style.userSelect = originalUserSelect;
      stage.removeEventListener("pointerdown", down);
      stage.removeEventListener("pointermove", move);
      stage.removeEventListener("pointerup", up);
      stage.removeEventListener("pointercancel", cancel);
      stage.removeEventListener("lostpointercapture", lostCapture);
      stage.removeEventListener("click", click, true);
      stage.removeEventListener("dragstart", drag);
      bindings.delete(stage);
    }
    bindings.set(stage, cleanup);
    return cleanup;
  }
  window.StoryGestures = Object.freeze({ bind });
})();
