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

export interface ChoiceBoardText {
  defaultChoices: ChoiceCard[];
  firstSetName: string;
  secondSetName: string;
  setNamePrefix: string;
  fallbackChoiceLabel: string;
  fallbackChoiceSetName: string;
  promptLabel: string;
  confirmationTemplate: string;
}

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

export const defaultChoiceBoardText: ChoiceBoardText = {
  defaultChoices,
  firstSetName: "おやつ",
  secondSetName: "あそび",
  setNamePrefix: "セット",
  fallbackChoiceLabel: "えらぶ",
  fallbackChoiceSetName: "セット",
  promptLabel: "カードをえらんでね",
  confirmationTemplate: "{label} にする",
};

export function createInitialChoiceBoardState(
  text: ChoiceBoardText = defaultChoiceBoardText,
): ChoiceBoardState {
  return {
    sets: [createDefaultChoiceSet("set-1", text.firstSetName, text)],
    activeSetId: "set-1",
    mode: "parent",
    parentPin: defaultParentPin,
  };
}

export function createChoiceBoardState(
  savedState: StoredChoiceBoardState | null,
  text: ChoiceBoardText = defaultChoiceBoardText,
): ChoiceBoardState {
  if (!savedState) {
    return createInitialChoiceBoardState(text);
  }

  if ("choices" in savedState) {
    const legacySet = createChoiceSet(
      "set-1",
      text.firstSetName,
      savedState.choices,
      savedState.selectedChoiceId,
      text,
    );

    return {
      sets: [legacySet],
      activeSetId: legacySet.id,
      mode: "parent",
      parentPin: defaultParentPin,
    };
  }

  const sets = normalizeChoiceSets(savedState.sets, text);
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

export function getChoiceConfirmation(
  state: ChoiceBoardState,
  text: ChoiceBoardText = defaultChoiceBoardText,
): ChoiceConfirmation {
  const selectedChoice = getSelectedChoice(state);

  return {
    selectedChoice,
    promptLabel: text.promptLabel,
    confirmationLabel: selectedChoice
      ? text.confirmationTemplate.replace("{label}", selectedChoice.label)
      : null,
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
  text: ChoiceBoardText = defaultChoiceBoardText,
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
        label: normalizeLabel(choice.label, text),
      },
    ],
  });
}

export function updateChoice(
  state: ChoiceBoardState,
  choiceId: string,
  updates: Pick<ChoiceCard, "emoji" | "label">,
  text: ChoiceBoardText = defaultChoiceBoardText,
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
          label: normalizeLabel(updates.label, text),
        };
      }),
      text,
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

export function addChoiceSet(
  state: ChoiceBoardState,
  text: ChoiceBoardText = defaultChoiceBoardText,
): ChoiceBoardState {
  const newSetId = createChoiceSetId(state.sets);
  const newSet = createDefaultChoiceSet(
    newSetId,
    createChoiceSetName(state.sets.length + 1, text),
    text,
  );

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
  text: ChoiceBoardText = defaultChoiceBoardText,
): ChoiceBoardState {
  return {
    ...state,
    sets: state.sets.map((set) =>
      set.id === setId ? { ...set, name: normalizeChoiceSetName(name, text) } : set,
    ),
  };
}

function normalizeChoices(
  choices: ChoiceCard[],
  text: ChoiceBoardText = defaultChoiceBoardText,
): ChoiceCard[] {
  const normalized = choices
    .slice(0, maxChoiceCards)
    .map((choice) => ({
      id: choice.id,
      emoji: normalizeEmoji(choice.emoji),
      label: normalizeLabel(choice.label, text),
    }));

  if (normalized.length >= minChoiceCards) {
    return normalized;
  }

  return text.defaultChoices.map((choice) => ({ ...choice }));
}

function normalizeChoiceSets(
  sets: ChoiceSet[],
  text: ChoiceBoardText = defaultChoiceBoardText,
): ChoiceSet[] {
  const normalized = sets.map((set, index) =>
    createChoiceSet(
      set.id || `set-${index + 1}`,
      set.name || createChoiceSetName(index + 1, text),
      set.choices,
      set.selectedChoiceId,
      text,
    ),
  );

  return normalized.length > 0 ? normalized : createInitialChoiceBoardState(text).sets;
}

function createDefaultChoiceSet(
  id: string,
  name: string,
  text: ChoiceBoardText = defaultChoiceBoardText,
): ChoiceSet {
  return createChoiceSet(id, name, text.defaultChoices, null, text);
}

function createChoiceSet(
  id: string,
  name: string,
  choicesToNormalize: ChoiceCard[],
  selectedChoiceId: string | null,
  text: ChoiceBoardText = defaultChoiceBoardText,
): ChoiceSet {
  const choices = normalizeChoices(choicesToNormalize, text);

  return {
    id,
    name: normalizeChoiceSetName(name, text),
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

function normalizeLabel(
  label: string,
  text: ChoiceBoardText = defaultChoiceBoardText,
): string {
  return label.trim() || text.fallbackChoiceLabel;
}

function normalizeChoiceSetName(
  name: string,
  text: ChoiceBoardText = defaultChoiceBoardText,
): string {
  return name.trim() || text.fallbackChoiceSetName;
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

function createChoiceSetName(
  index: number,
  text: ChoiceBoardText = defaultChoiceBoardText,
): string {
  if (index === 1) return text.firstSetName;
  if (index === 2) return text.secondSetName;

  return `${text.setNamePrefix} ${index}`;
}
