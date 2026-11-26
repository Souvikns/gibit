import { expect, test } from "bun:test";
import { labelTint } from "./labels";

test("labelTint derives a readable tint from the label's real color", () => {
  expect(labelTint("ff0000")).toEqual(labelTint("#ff0000"));
  const tint = labelTint("ff0000");
  expect(tint.background).toBe("rgb(255, 219, 219)");
  expect(tint.color).toBe("rgb(166, 0, 0)");
});

test("labelTint tolerates short or invalid hex", () => {
  expect(labelTint("zz").background).toBe("rgb(219, 219, 219)");
});
