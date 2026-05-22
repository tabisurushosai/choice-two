export interface ChoiceCard {
  id: string;
  emoji: string;
  label: string;
}

export interface ChoiceBoardState {
  choices: ChoiceCard[];
  selectedChoiceId: string | null;
}

const defaultChoices: ChoiceCard[] = [
  { id: "apple", emoji: "🍎", label: "りんご" },
  { id: "banana", emoji: "🍌", label: "バナナ" },
];

export function createInitialChoiceBoardState(): ChoiceBoardState {
  return {
    choices: defaultChoices,
    selectedChoiceId: null,
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
