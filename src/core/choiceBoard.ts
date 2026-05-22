export interface ChoiceCard {
  id: string;
  emoji: string;
  label: string;
}

export interface ChoiceSet {
  id: string;
  name: string;
  choices: ChoiceCard[];
  selectedChoiceId: string | null;
}

export interface ChoiceBoardState {
  sets: ChoiceSet[];
  activeSetId: string;
  mode: ChoiceBoardMode;
  parentPin: string;
}

export interface ChoiceConfirmation {
  selectedChoice: ChoiceCard | null;
  promptLabel: string;
  confirmationLabel: string | null;
}

export type ChoiceBoardMode = "parent" | "child";

export const choiceBoardStorageKey = "choiceBoardState";
export const minChoiceCards = 2;
export const maxChoiceCards = 4;
export const defaultParentPin = "1234";

export interface LegacyChoiceBoardState {
  choices: ChoiceCard[];
  selectedChoiceId: string | null;
}

export type StoredChoiceBoardState = ChoiceBoardState | LegacyChoiceBoardState;

const defaultChoices: ChoiceCard[] = [
  { id: "apple", emoji: "🍎", label: "りんご" },
  { id: "banana", emoji: "🍌", label: "バナナ" },
];

export function createInitialChoiceBoardState(): ChoiceBoardState {
  return {
    sets: [createDefaultChoiceSet("set-1", "おやつ")],
    activeSetId: "set-1",
    mode: "parent",
    parentPin: defaultParentPin,
  };
}

export function createChoiceBoardState(
  savedState: StoredChoiceBoardState | null,
): ChoiceBoardState {
  if (!savedState) {
    return createInitialChoiceBoardState();
  }

  if ("choices" in savedState) {
    const legacySet = createChoiceSet(
      "set-1",
      "おやつ",
      savedState.choices,
      savedState.selectedChoiceId,
    );

    return {
      sets: [legacySet],
      activeSetId: legacySet.id,
      mode: "parent",
      parentPin: defaultParentPin,
    };
  }

  const sets = normalizeChoiceSets(savedState.sets);
  const activeSetId = sets.some((set) => set.id === savedState.activeSetId)
    ? savedState.activeSetId
    : sets[0].id;

  return {
    sets,
    activeSetId,
    mode: normalizeChoiceBoardMode(savedState.mode),
    parentPin: normalizeParentPin(savedState.parentPin),
  };
}

export function switchToChildMode(state: ChoiceBoardState): ChoiceBoardState {
  return {
    ...state,
    mode: "child",
  };
}

export function canUnlockParentMode(state: ChoiceBoardState, pin: string): boolean {
  return normalizeParentPin(pin) === state.parentPin;
}

export function switchToParentMode(
  state: ChoiceBoardState,
  pin: string,
): ChoiceBoardState {
  if (!canUnlockParentMode(state, pin)) return state;

  return {
    ...state,
    mode: "parent",
  };
}

export function updateParentPin(
  state: ChoiceBoardState,
  pin: string,
): ChoiceBoardState {
  return {
    ...state,
    parentPin: normalizeParentPin(pin),
  };
}

export function selectChoice(
  state: ChoiceBoardState,
  choiceId: string,
): ChoiceBoardState {
  const activeSet = getActiveChoiceSet(state);
  const exists = activeSet.choices.some((choice) => choice.id === choiceId);

  return updateActiveChoiceSet(state, {
    ...activeSet,
    selectedChoiceId: exists ? choiceId : activeSet.selectedChoiceId,
  });
}

export function getSelectedChoice(state: ChoiceBoardState): ChoiceCard | null {
  const activeSet = getActiveChoiceSet(state);

  return activeSet.choices.find((choice) => choice.id === activeSet.selectedChoiceId) ?? null;
}

export function getChoiceConfirmation(state: ChoiceBoardState): ChoiceConfirmation {
  const selectedChoice = getSelectedChoice(state);

  return {
    selectedChoice,
    promptLabel: "カードをえらんでね",
    confirmationLabel: selectedChoice ? `${selectedChoice.label} にする` : null,
  };
}

export function canAddChoice(state: ChoiceBoardState): boolean {
  return getActiveChoiceSet(state).choices.length < maxChoiceCards;
}

export function canRemoveChoice(state: ChoiceBoardState): boolean {
  return getActiveChoiceSet(state).choices.length > minChoiceCards;
}

export function addChoice(
  state: ChoiceBoardState,
  choice: Pick<ChoiceCard, "emoji" | "label">,
): ChoiceBoardState {
  if (!canAddChoice(state)) return state;
  const activeSet = getActiveChoiceSet(state);

  return updateActiveChoiceSet(state, {
    ...activeSet,
    choices: [
      ...activeSet.choices,
      {
        id: createChoiceId(activeSet.choices),
        emoji: normalizeEmoji(choice.emoji),
        label: normalizeLabel(choice.label),
      },
    ],
  });
}

export function updateChoice(
  state: ChoiceBoardState,
  choiceId: string,
  updates: Pick<ChoiceCard, "emoji" | "label">,
): ChoiceBoardState {
  const activeSet = getActiveChoiceSet(state);

  return updateActiveChoiceSet(state, {
    ...activeSet,
    choices: normalizeChoices(
      activeSet.choices.map((choice) => {
        if (choice.id !== choiceId) return choice;

        return {
          ...choice,
          emoji: normalizeEmoji(updates.emoji),
          label: normalizeLabel(updates.label),
        };
      }),
    ),
  });
}

export function removeChoice(
  state: ChoiceBoardState,
  choiceId: string,
): ChoiceBoardState {
  if (!canRemoveChoice(state)) return state;
  const activeSet = getActiveChoiceSet(state);

  const choices = activeSet.choices.filter((choice) => choice.id !== choiceId);
  const selectedChoiceId =
    activeSet.selectedChoiceId === choiceId ? null : activeSet.selectedChoiceId;

  return updateActiveChoiceSet(state, {
    ...activeSet,
    choices,
    selectedChoiceId,
  });
}

export function getActiveChoiceSet(state: ChoiceBoardState): ChoiceSet {
  return (
    state.sets.find((set) => set.id === state.activeSetId) ??
    state.sets[0] ??
    createInitialChoiceBoardState().sets[0]
  );
}

export function switchChoiceSet(
  state: ChoiceBoardState,
  setId: string,
): ChoiceBoardState {
  const activeSetId = state.sets.some((set) => set.id === setId)
    ? setId
    : state.activeSetId;

  return {
    ...state,
    activeSetId,
  };
}

export function addChoiceSet(state: ChoiceBoardState): ChoiceBoardState {
  const newSetId = createChoiceSetId(state.sets);
  const newSet = createDefaultChoiceSet(newSetId, createChoiceSetName(state.sets.length + 1));

  return {
    ...state,
    sets: [...state.sets, newSet],
    activeSetId: newSet.id,
  };
}

export function updateChoiceSetName(
  state: ChoiceBoardState,
  setId: string,
  name: string,
): ChoiceBoardState {
  return {
    ...state,
    sets: state.sets.map((set) =>
      set.id === setId ? { ...set, name: normalizeChoiceSetName(name) } : set,
    ),
  };
}

function normalizeChoices(choices: ChoiceCard[]): ChoiceCard[] {
  const normalized = choices
    .slice(0, maxChoiceCards)
    .map((choice) => ({
      id: choice.id,
      emoji: normalizeEmoji(choice.emoji),
      label: normalizeLabel(choice.label),
    }));

  if (normalized.length >= minChoiceCards) {
    return normalized;
  }

  return defaultChoices.map((choice) => ({ ...choice }));
}

function normalizeChoiceSets(sets: ChoiceSet[]): ChoiceSet[] {
  const normalized = sets.map((set, index) =>
    createChoiceSet(
      set.id || `set-${index + 1}`,
      set.name || createChoiceSetName(index + 1),
      set.choices,
      set.selectedChoiceId,
    ),
  );

  return normalized.length > 0 ? normalized : createInitialChoiceBoardState().sets;
}

function createDefaultChoiceSet(id: string, name: string): ChoiceSet {
  return createChoiceSet(id, name, defaultChoices, null);
}

function createChoiceSet(
  id: string,
  name: string,
  choicesToNormalize: ChoiceCard[],
  selectedChoiceId: string | null,
): ChoiceSet {
  const choices = normalizeChoices(choicesToNormalize);

  return {
    id,
    name: normalizeChoiceSetName(name),
    choices,
    selectedChoiceId: choices.some((choice) => choice.id === selectedChoiceId)
      ? selectedChoiceId
      : null,
  };
}

function updateActiveChoiceSet(
  state: ChoiceBoardState,
  nextActiveSet: ChoiceSet,
): ChoiceBoardState {
  return {
    ...state,
    sets: state.sets.map((set) => (set.id === state.activeSetId ? nextActiveSet : set)),
  };
}

function normalizeEmoji(emoji: string): string {
  return emoji.trim() || "❓";
}

function normalizeLabel(label: string): string {
  return label.trim() || "えらぶ";
}

function normalizeChoiceSetName(name: string): string {
  return name.trim() || "セット";
}

function normalizeChoiceBoardMode(mode: unknown): ChoiceBoardMode {
  return mode === "child" ? "child" : "parent";
}

function normalizeParentPin(pin: unknown): string {
  if (typeof pin !== "string") return defaultParentPin;

  const digits = pin.replace(/\D/g, "").slice(0, 8);
  return digits || defaultParentPin;
}

function createChoiceId(choices: ChoiceCard[]): string {
  const existingIds = new Set(choices.map((choice) => choice.id));
  let index = choices.length + 1;
  let id = `choice-${index}`;

  while (existingIds.has(id)) {
    index += 1;
    id = `choice-${index}`;
  }

  return id;
}

function createChoiceSetId(sets: ChoiceSet[]): string {
  const existingIds = new Set(sets.map((set) => set.id));
  let index = sets.length + 1;
  let id = `set-${index}`;

  while (existingIds.has(id)) {
    index += 1;
    id = `set-${index}`;
  }

  return id;
}

function createChoiceSetName(index: number): string {
  if (index === 1) return "おやつ";
  if (index === 2) return "あそび";

  return `セット ${index}`;
}
