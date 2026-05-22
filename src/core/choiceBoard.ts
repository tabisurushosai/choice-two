export interface ChoiceCard {
  id: string;
  emoji: string;
  label: string;
}

export interface ChoiceBoardState {
  choices: ChoiceCard[];
  selectedChoiceId: string | null;
}

export interface ChoiceConfirmation {
  selectedChoice: ChoiceCard | null;
  promptLabel: string;
  confirmationLabel: string | null;
}

export const choiceBoardStorageKey = "choiceBoardState";
export const minChoiceCards = 2;
export const maxChoiceCards = 4;

const defaultChoices: ChoiceCard[] = [
  { id: "apple", emoji: "🍎", label: "りんご" },
  { id: "banana", emoji: "🍌", label: "バナナ" },
];

export function createInitialChoiceBoardState(): ChoiceBoardState {
  return {
    choices: defaultChoices.map((choice) => ({ ...choice })),
    selectedChoiceId: null,
  };
}

export function createChoiceBoardState(
  savedState: ChoiceBoardState | null,
): ChoiceBoardState {
  if (!savedState) {
    return createInitialChoiceBoardState();
  }

  const choices = normalizeChoices(savedState.choices);
  const selectedChoiceId = choices.some((choice) => choice.id === savedState.selectedChoiceId)
    ? savedState.selectedChoiceId
    : null;

  return {
    choices,
    selectedChoiceId,
  };
}

export function selectChoice(
  state: ChoiceBoardState,
  choiceId: string,
): ChoiceBoardState {
  const exists = state.choices.some((choice) => choice.id === choiceId);

  return {
    ...state,
    selectedChoiceId: exists ? choiceId : state.selectedChoiceId,
  };
}

export function getSelectedChoice(state: ChoiceBoardState): ChoiceCard | null {
  return state.choices.find((choice) => choice.id === state.selectedChoiceId) ?? null;
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
  return state.choices.length < maxChoiceCards;
}

export function canRemoveChoice(state: ChoiceBoardState): boolean {
  return state.choices.length > minChoiceCards;
}

export function addChoice(
  state: ChoiceBoardState,
  choice: Pick<ChoiceCard, "emoji" | "label">,
): ChoiceBoardState {
  if (!canAddChoice(state)) return state;

  return {
    ...state,
    choices: [
      ...state.choices,
      {
        id: createChoiceId(state.choices),
        emoji: normalizeEmoji(choice.emoji),
        label: normalizeLabel(choice.label),
      },
    ],
  };
}

export function updateChoice(
  state: ChoiceBoardState,
  choiceId: string,
  updates: Pick<ChoiceCard, "emoji" | "label">,
): ChoiceBoardState {
  return {
    ...state,
    choices: normalizeChoices(
      state.choices.map((choice) => {
        if (choice.id !== choiceId) return choice;

        return {
          ...choice,
          emoji: normalizeEmoji(updates.emoji),
          label: normalizeLabel(updates.label),
        };
      }),
    ),
  };
}

export function removeChoice(
  state: ChoiceBoardState,
  choiceId: string,
): ChoiceBoardState {
  if (!canRemoveChoice(state)) return state;

  const choices = state.choices.filter((choice) => choice.id !== choiceId);
  const selectedChoiceId = state.selectedChoiceId === choiceId ? null : state.selectedChoiceId;

  return {
    choices,
    selectedChoiceId,
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

  return createInitialChoiceBoardState().choices;
}

function normalizeEmoji(emoji: string): string {
  return emoji.trim() || "❓";
}

function normalizeLabel(label: string): string {
  return label.trim() || "えらぶ";
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
