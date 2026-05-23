import { describe, expect, it } from "vitest";
import {
  createInitialChoiceBoardState,
  defaultParentPin,
  freeChoiceSetLimit,
  freeMaxChoiceCards,
  getActiveChoiceSet,
  getPremiumGate,
  getVisibleChoices,
  minChoiceCards,
} from "./choiceBoard";

describe("choiceBoard", () => {
  it("creates a free initial board with visible choices", () => {
    const state = createInitialChoiceBoardState();
    const activeSet = getActiveChoiceSet(state);
    const premium = getPremiumGate(state, 0);

    expect(state.mode).toBe("parent");
    expect(state.parentPin).toBe(defaultParentPin);
    expect(state.sets).toHaveLength(freeChoiceSetLimit);
    expect(activeSet.id).toBe(state.activeSetId);
    expect(getVisibleChoices(state)).toHaveLength(minChoiceCards);
    expect(premium.status).toBe("free");
    expect(premium.maxCards).toBe(freeMaxChoiceCards);
    expect(premium.maxSets).toBe(freeChoiceSetLimit);
  });
});
