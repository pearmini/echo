import Echo from "echox";
import {test, expect} from "vitest";

test("reactive().join() should return defaults reactive", () => {
  const ctx = Echo.reactive().join();
  expect(ctx).toEqual({});
});

test("reactive().prop() should define a default prop", () => {
  const ctx = Echo.reactive();
  const ctx2 = ctx.prop("test", () => "hello");
  expect(ctx).toBe(ctx2);
});

test("reactive.state() should effect a state", () => {
  const ctx = Echo.reactive();
  const ctx2 = ctx.state("test", () => "hello");
  expect(ctx).toBe(ctx2);
});
