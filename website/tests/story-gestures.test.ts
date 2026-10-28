interface TestPointer {
  target: object;
  pointerId: number;
  pointerType?: string;
  isPrimary?: boolean;
  clientX?: number;
  clientY?: number;
  cancelable?: boolean;
  preventDefault?: () => void;
  stopImmediatePropagation?: () => void;
}
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(
  new URL("../deploy/dist/story-gestures.js", import.meta.url),
  "utf8",
);
function setup() {
  const window = {} as Pick<Window, "StoryGestures">;
  vm.runInNewContext(source, {
    window,
    performance: { now: () => 100 },
    setTimeout,
    clearTimeout,
  });
  const listeners = new Map<string, (event: TestPointer) => void>(),
    properties = new Map<string, string>(),
    swipes: string[] = [];
  let captured = false;
  const child = { closest: () => null };
  const card = {
    isConnected: true,
    style: {
      getPropertyValue: (key: string) => properties.get(key) || "",
      getPropertyPriority: () => "",
      setProperty: (key: string, value: string) => properties.set(key, value),
      removeProperty: (key: string) => properties.delete(key),
    },
  };
  const stage = {
    clientWidth: 330,
    style: { touchAction: "", userSelect: "" },
    querySelectorAll: () => [card],
    addEventListener: (name: string, callback: (event: TestPointer) => void) =>
      listeners.set(name, callback),
    removeEventListener: (name: string) => listeners.delete(name),
    hasPointerCapture: () => captured,
    setPointerCapture: (id: number) => {
      captured = true;
      // Reproduce a phone transferring implicit capture off the nested button.
      listeners.get("lostpointercapture")?.({ target: child, pointerId: id });
    },
    releasePointerCapture: (id: number) => {
      captured = false;
      listeners.get("lostpointercapture")?.({ target: stage, pointerId: id });
    },
  };
  const cleanup = window.StoryGestures.bind(stage as unknown as HTMLElement, {
    onSwipe: (direction) => swipes.push(direction),
    reduced: true,
  });
  const emit = (name: string, x: number, y = 100, target: object = child) =>
    listeners.get(name)?.({
      target,
      pointerId: 7,
      pointerType: "touch",
      isPrimary: true,
      clientX: x,
      clientY: y,
      cancelable: true,
      preventDefault() {},
      stopImmediatePropagation() {},
    });
  return { emit, swipes, cleanup, stage };
}

for (const [direction, start, end] of [
  ["left", 230, 100],
  ["right", 100, 230],
] as const) {
  test(`touch ${direction} survives implicit capture transfer`, () => {
    const fixture = setup();
    fixture.emit("pointerdown", start);
    fixture.emit("pointermove", (start + end) / 2);
    fixture.emit("pointermove", end);
    fixture.emit("pointerup", end);
    assert.deepEqual(fixture.swipes, [direction]);
    fixture.cleanup();
  });
}

test("vertical page scrolling does not change the card", () => {
  const fixture = setup();
  fixture.emit("pointerdown", 100);
  fixture.emit("pointermove", 104, 150);
  fixture.emit("pointerup", 104, 190);
  assert.deepEqual(fixture.swipes, []);
  fixture.cleanup();
});

test("a real pointer cancellation does not commit a swipe", () => {
  const fixture = setup();
  fixture.emit("pointerdown", 230);
  fixture.emit("pointermove", 100);
  fixture.emit("pointercancel", 100);
  fixture.emit("pointerup", 100);
  assert.deepEqual(fixture.swipes, []);
  fixture.cleanup();
});
