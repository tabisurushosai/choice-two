export interface ChoiceCard {
  id: string;
  emoji: string;
  label: string;
}

export interface ChoiceBoardState {
  choices: ChoiceCard[];
  selectedChoiceId: string | null;
}

export const choiceBoardStorageKey = "choiceBoardState";

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

  const choices = savedState.choices.map((choice) => ({ ...choice }));
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
