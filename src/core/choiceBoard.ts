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
  choiceMode: ChoiceMode;
}

export interface ChoiceBoardState {
  sets: ChoiceSet[];
  activeSetId: string;
  mode: ChoiceBoardMode;
  parentPin: string;
  premium: PremiumState;
}

export interface ChoiceConfirmation {
  selectedChoice: ChoiceCard | null;
  promptLabel: string;
  confirmationLabel: string | null;
}

export interface RemovedChoiceSnapshot {
  setId: string;
  choice: ChoiceCard;
  index: number;
  selectedChoiceId: string | null;
}

export type ChoiceBoardMode = "parent" | "child";
export type ChoiceMode = 2 | 4;
export type ChoiceNavigationDirection = "next" | "previous" | "first" | "last";
export type PremiumStatus = "free" | "trial" | "premium";

export interface PremiumState {
  trialStartedAt: number | null;
  premiumUnlocked: boolean;
}

export interface PremiumGate {
  status: PremiumStatus;
  trialEndsAt: number | null;
  maxCards: number;
  maxSets: number | null;
  checkoutUrl: string;
}

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
export const choiceModes: ChoiceMode[] = [2, 4];
export const freeMaxChoiceCards = 3;
export const premiumMaxChoiceCards = 6;
export const maxChoiceCards = premiumMaxChoiceCards;
export const freeChoiceSetLimit = 1;
export const premiumTrialDays = 7;
export const premiumTrialMs = premiumTrialDays * 24 * 60 * 60 * 1000;
export const stripeCheckoutUrl = "https://buy.stripe.com/test_choice_two_premium";
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
    premium: createFreePremiumState(),
  };
}

export function createChoiceBoardState(
  savedState: unknown,
  text: ChoiceBoardText = defaultChoiceBoardText,
): ChoiceBoardState {
  if (!isRecord(savedState)) {
    return createInitialChoiceBoardState(text);
  }

  if (Array.isArray(savedState.choices)) {
    const premium = createFreePremiumState();
    const legacySet = createChoiceSet(
      "set-1",
      text.firstSetName,
      savedState.choices,
      savedState.selectedChoiceId,
      normalizeChoiceMode(undefined, savedState.choices, getChoiceCardLimit({ premium })),
      text,
      getChoiceCardLimit({ premium }),
    );

    return {
      sets: [legacySet],
      activeSetId: legacySet.id,
      mode: "parent",
      parentPin: defaultParentPin,
      premium,
    };
  }

  if (!Array.isArray(savedState.sets)) {
    return createInitialChoiceBoardState(text);
  }

  const premium = normalizePremiumState(savedState);
  const hasPremium = hasPremiumAccess({ premium });
  const sets = normalizeChoiceSets(
    savedState.sets,
    text,
    getChoiceCardLimit({ premium }),
    hasPremium ? null : freeChoiceSetLimit,
  );
  const activeSetId = sets.some((set) => set.id === savedState.activeSetId)
    ? String(savedState.activeSetId)
    : sets[0].id;

  return {
    sets,
    activeSetId,
    mode: normalizeChoiceBoardMode(savedState.mode),
    parentPin: normalizeParentPin(savedState.parentPin),
    premium,
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

export function clearSelectedChoice(state: ChoiceBoardState): ChoiceBoardState {
  const activeSet = getActiveChoiceSet(state);

  if (activeSet.selectedChoiceId === null) return state;

  return updateActiveChoiceSet(state, {
    ...activeSet,
    selectedChoiceId: null,
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

export function getChoiceNavigationTarget(
  state: ChoiceBoardState,
  currentChoiceId: string,
  direction: ChoiceNavigationDirection,
): string | null {
  const choices = getVisibleChoices(state);
  if (choices.length === 0) return null;

  const currentIndex = choices.findIndex((choice) => choice.id === currentChoiceId);
  const index = currentIndex === -1 ? 0 : currentIndex;

  if (direction === "first") return choices[0].id;
  if (direction === "last") return choices[choices.length - 1].id;
  if (direction === "previous") {
    return choices[(index - 1 + choices.length) % choices.length].id;
  }

  return choices[(index + 1) % choices.length].id;
}

export function canAddChoice(state: ChoiceBoardState): boolean {
  return getActiveChoiceSet(state).choices.length < getChoiceCardLimit(state);
}

export function canRemoveChoice(state: ChoiceBoardState): boolean {
  return getActiveChoiceSet(state).choices.length > minChoiceCards;
}

export function hasActiveChoices(state: ChoiceBoardState): boolean {
  return getVisibleChoices(state).length > 0;
}

export function getVisibleChoices(state: ChoiceBoardState): ChoiceCard[] {
  const activeSet = getActiveChoiceSet(state);

  return activeSet.choices.slice(0, activeSet.choiceMode);
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

export function canUseChoiceMode(
  state: ChoiceBoardState,
  choiceMode: ChoiceMode,
): boolean {
  return choiceMode <= getChoiceCardLimit(state);
}

export function setChoiceMode(
  state: ChoiceBoardState,
  choiceMode: ChoiceMode,
  text: ChoiceBoardText = defaultChoiceBoardText,
): ChoiceBoardState {
  if (!canUseChoiceMode(state, choiceMode)) return state;
  const activeSet = getActiveChoiceSet(state);
  const choices = fillChoicesToMode(activeSet.choices, choiceMode, text);
  const visibleChoiceIds = new Set(choices.slice(0, choiceMode).map((choice) => choice.id));

  return updateActiveChoiceSet(state, {
    ...activeSet,
    choiceMode,
    choices,
    selectedChoiceId:
      activeSet.selectedChoiceId && visibleChoiceIds.has(activeSet.selectedChoiceId)
        ? activeSet.selectedChoiceId
        : null,
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
      getChoiceCardLimit(state),
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
  const choiceMode = normalizeChoiceMode(activeSet.choiceMode, choices, getChoiceCardLimit(state));
  const selectedChoiceId =
    activeSet.selectedChoiceId === choiceId ? null : activeSet.selectedChoiceId;

  return updateActiveChoiceSet(state, {
    ...activeSet,
    choices,
    choiceMode,
    selectedChoiceId,
  });
}

export function createRemovedChoiceSnapshot(
  state: ChoiceBoardState,
  choiceId: string,
): RemovedChoiceSnapshot | null {
  if (!canRemoveChoice(state)) return null;
  const activeSet = getActiveChoiceSet(state);
  const index = activeSet.choices.findIndex((choice) => choice.id === choiceId);
  if (index === -1) return null;

  return {
    setId: activeSet.id,
    choice: activeSet.choices[index],
    index,
    selectedChoiceId: activeSet.selectedChoiceId,
  };
}

export function canRestoreRemovedChoice(
  state: ChoiceBoardState,
  removedChoice: RemovedChoiceSnapshot | null,
): boolean {
  if (!removedChoice) return false;
  const set = state.sets.find((item) => item.id === removedChoice.setId);
  if (!set) return false;
  if (set.choices.some((choice) => choice.id === removedChoice.choice.id)) return false;

  return set.choices.length < getChoiceCardLimit(state);
}

export function restoreRemovedChoice(
  state: ChoiceBoardState,
  removedChoice: RemovedChoiceSnapshot | null,
): ChoiceBoardState {
  if (!canRestoreRemovedChoice(state, removedChoice) || !removedChoice) return state;

  return {
    ...state,
    sets: state.sets.map((set) => {
      if (set.id !== removedChoice.setId) return set;

      const insertAt = Math.max(0, Math.min(removedChoice.index, set.choices.length));
      const choices = [
        ...set.choices.slice(0, insertAt),
        removedChoice.choice,
        ...set.choices.slice(insertAt),
      ];

      return {
        ...set,
        choices,
        choiceMode: normalizeChoiceMode(set.choiceMode, choices, getChoiceCardLimit(state)),
        selectedChoiceId: choices.some(
          (choice) => choice.id === removedChoice.selectedChoiceId,
        )
          ? removedChoice.selectedChoiceId
          : set.selectedChoiceId,
      };
    }),
  };
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
  now = Date.now(),
): ChoiceBoardState {
  if (!canAddChoiceSet(state, now)) return state;

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

export function canAddChoiceSet(
  state: ChoiceBoardState,
  now = Date.now(),
): boolean {
  return hasPremiumAccess(state, now) || state.sets.length < freeChoiceSetLimit;
}

export function startPremiumTrial(
  state: ChoiceBoardState,
  now = Date.now(),
): ChoiceBoardState {
  if (state.premium.trialStartedAt !== null || state.premium.premiumUnlocked) {
    return state;
  }

  return {
    ...state,
    premium: {
      ...state.premium,
      trialStartedAt: now,
    },
  };
}

export function getPremiumGate(
  state: ChoiceBoardState,
  now = Date.now(),
): PremiumGate {
  const trialEndsAt =
    state.premium.trialStartedAt === null
      ? null
      : state.premium.trialStartedAt + premiumTrialMs;
  const hasAccess = hasPremiumAccess(state, now);

  return {
    status: state.premium.premiumUnlocked ? "premium" : hasAccess ? "trial" : "free",
    trialEndsAt: hasAccess && !state.premium.premiumUnlocked ? trialEndsAt : null,
    maxCards: hasAccess ? premiumMaxChoiceCards : freeMaxChoiceCards,
    maxSets: hasAccess ? null : freeChoiceSetLimit,
    checkoutUrl: stripeCheckoutUrl,
  };
}

export function hasPremiumAccess(
  state: Pick<ChoiceBoardState, "premium">,
  now = Date.now(),
): boolean {
  if (state.premium.premiumUnlocked) return true;
  if (state.premium.trialStartedAt === null) return false;

  return now < state.premium.trialStartedAt + premiumTrialMs;
}

export function getChoiceCardLimit(
  state: Pick<ChoiceBoardState, "premium">,
  now = Date.now(),
): number {
  return hasPremiumAccess(state, now) ? premiumMaxChoiceCards : freeMaxChoiceCards;
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
  choices: unknown,
  text: ChoiceBoardText = defaultChoiceBoardText,
  maxCards = maxChoiceCards,
): ChoiceCard[] {
  const normalized = (Array.isArray(choices) ? choices : [])
    .slice(0, maxCards)
    .filter(isRecord)
    .map((choice) => ({
      id: normalizeId(choice.id),
      emoji: normalizeEmoji(choice.emoji),
      label: normalizeLabel(choice.label, text),
    }))
    .filter((choice) => choice.id !== "");

  if (normalized.length >= minChoiceCards) {
    return normalized;
  }

  return text.defaultChoices.map((choice) => ({ ...choice }));
}

function normalizeChoiceSets(
  sets: unknown,
  text: ChoiceBoardText = defaultChoiceBoardText,
  maxCards = maxChoiceCards,
  maxSets: number | null = null,
): ChoiceSet[] {
  const validSets = (Array.isArray(sets) ? sets : []).filter(isRecord);
  const setsToNormalize = maxSets === null ? validSets : validSets.slice(0, maxSets);
  const normalized = setsToNormalize.map((set, index) =>
    createChoiceSet(
      normalizeId(set.id) || `set-${index + 1}`,
      typeof set.name === "string" ? set.name : createChoiceSetName(index + 1, text),
      set.choices,
      typeof set.selectedChoiceId === "string" ? set.selectedChoiceId : null,
      normalizeChoiceMode(set.choiceMode, set.choices, maxCards),
      text,
      maxCards,
    ),
  );

  return normalized.length > 0 ? normalized : createInitialChoiceBoardState(text).sets;
}

function createDefaultChoiceSet(
  id: string,
  name: string,
  text: ChoiceBoardText = defaultChoiceBoardText,
): ChoiceSet {
  return createChoiceSet(id, name, text.defaultChoices, null, minChoiceCards, text);
}

function createChoiceSet(
  id: string,
  name: string,
  choicesToNormalize: unknown,
  selectedChoiceId: unknown,
  choiceModeToNormalize: unknown,
  text: ChoiceBoardText = defaultChoiceBoardText,
  maxCards = maxChoiceCards,
): ChoiceSet {
  const choices = normalizeChoices(choicesToNormalize, text, maxCards);
  const choiceMode = normalizeChoiceMode(choiceModeToNormalize, choices, maxCards);

  return {
    id,
    name: normalizeChoiceSetName(name, text),
    choices,
    choiceMode,
    selectedChoiceId:
      typeof selectedChoiceId === "string" &&
      choices.slice(0, choiceMode).some((choice) => choice.id === selectedChoiceId)
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

function normalizeEmoji(emoji: unknown): string {
  if (typeof emoji !== "string") return "❓";

  return emoji.trim() || "❓";
}

function normalizeLabel(
  label: unknown,
  text: ChoiceBoardText = defaultChoiceBoardText,
): string {
  if (typeof label !== "string") return text.fallbackChoiceLabel;

  return label.trim() || text.fallbackChoiceLabel;
}

function normalizeChoiceSetName(
  name: unknown,
  text: ChoiceBoardText = defaultChoiceBoardText,
): string {
  if (typeof name !== "string") return text.fallbackChoiceSetName;

  return name.trim() || text.fallbackChoiceSetName;
}

function normalizeId(id: unknown): string {
  if (typeof id !== "string") return "";

  return id.trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function normalizeChoiceBoardMode(mode: unknown): ChoiceBoardMode {
  return mode === "child" ? "child" : "parent";
}

function normalizeParentPin(pin: unknown): string {
  if (typeof pin !== "string") return defaultParentPin;

  const digits = pin.replace(/\D/g, "").slice(0, 8);
  return digits || defaultParentPin;
}

function normalizeChoiceMode(
  choiceMode: unknown,
  choices: unknown,
  maxCards = maxChoiceCards,
): ChoiceMode {
  const availableChoices = Array.isArray(choices) ? choices.length : 0;
  if (choiceMode === 4 && maxCards >= 4) return 4;
  if (choiceMode === 2) return 2;

  return availableChoices >= 4 && maxCards >= 4 ? 4 : 2;
}

function fillChoicesToMode(
  choices: ChoiceCard[],
  choiceMode: ChoiceMode,
  text: ChoiceBoardText = defaultChoiceBoardText,
): ChoiceCard[] {
  if (choices.length >= choiceMode) return choices;

  let nextChoices = choices;
  while (nextChoices.length < choiceMode) {
    nextChoices = [
      ...nextChoices,
      {
        id: createChoiceId(nextChoices),
        emoji: "⭐",
        label: text.fallbackChoiceLabel,
      },
    ];
  }

  return nextChoices;
}

function createFreePremiumState(): PremiumState {
  return {
    trialStartedAt: null,
    premiumUnlocked: false,
  };
}

function normalizePremiumState(savedState: unknown): PremiumState {
  if (
    !savedState ||
    typeof savedState !== "object" ||
    !("premium" in savedState) ||
    !savedState.premium ||
    typeof savedState.premium !== "object"
  ) {
    return createFreePremiumState();
  }

  const premium = savedState.premium as Partial<PremiumState>;
  const trialStartedAt =
    typeof premium.trialStartedAt === "number" && Number.isFinite(premium.trialStartedAt)
      ? premium.trialStartedAt
      : null;

  return {
    trialStartedAt,
    premiumUnlocked: premium.premiumUnlocked === true,
  };
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
