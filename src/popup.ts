import {
  addChoice,
  addChoiceSet,
  canAddChoice,
  canRemoveChoice,
  ChoiceBoardState,
  ChoiceCard,
  choiceBoardStorageKey,
  createChoiceBoardState,
  createInitialChoiceBoardState,
  getActiveChoiceSet,
  getChoiceConfirmation,
  maxChoiceCards,
  minChoiceCards,
  removeChoice,
  selectChoice,
  switchChoiceSet,
  updateChoice,
  updateChoiceSetName,
} from "./core/choiceBoard";
import { store } from "./storage";

const app = document.querySelector<HTMLDivElement>("#app");

let state = createInitialChoiceBoardState();

function renderChoiceCard(
  choice: ChoiceCard,
  selectedChoiceId: string | null,
): HTMLButtonElement {
  const isSelected = choice.id === selectedChoiceId;
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.choiceId = choice.id;
  button.className = isSelected ? "choice-card choice-card--selected" : "choice-card";
  button.setAttribute("aria-label", choice.label);
  button.setAttribute("aria-pressed", String(isSelected));

  const emoji = document.createElement("span");
  emoji.className = "choice-card__emoji";
  emoji.textContent = choice.emoji;

  const label = document.createElement("span");
  label.className = "choice-card__label";
  label.textContent = choice.label;

  button.append(emoji, label);
  return button;
}

function renderConfirmation(stateToRender: ChoiceBoardState): HTMLElement {
  const confirmationModel = getChoiceConfirmation(stateToRender);
  const confirmation = document.createElement("section");
  confirmation.className = confirmationModel.selectedChoice
    ? "confirmation confirmation--selected"
    : "confirmation";
  confirmation.setAttribute("aria-live", "polite");

  if (!confirmationModel.selectedChoice) {
    confirmation.textContent = confirmationModel.promptLabel;
    return confirmation;
  }

  const emoji = document.createElement("div");
  emoji.className = "confirmation__emoji";
  emoji.textContent = confirmationModel.selectedChoice.emoji;

  const label = document.createElement("div");
  label.className = "confirmation__label";
  label.textContent = confirmationModel.confirmationLabel;

  confirmation.append(emoji, label);
  return confirmation;
}

function render(): void {
  if (!app) return;
  const activeSet = getActiveChoiceSet(state);

  const shell = document.createElement("main");
  shell.className = "choice-board";

  const choices = document.createElement("div");
  choices.className = "choice-board__cards";

  for (const choice of activeSet.choices) {
    choices.append(renderChoiceCard(choice, activeSet.selectedChoiceId));
  }

  shell.append(renderSetSwitcher(state), choices, renderConfirmation(state), renderEditor(state));
  app.replaceChildren(shell);
}

function renderSetSwitcher(stateToRender: ChoiceBoardState): HTMLElement {
  const activeSet = getActiveChoiceSet(stateToRender);
  const switcher = document.createElement("section");
  switcher.className = "choice-set";
  switcher.setAttribute("aria-label", "セット切替");

  const label = document.createElement("label");
  label.className = "choice-set__label";
  label.textContent = "セット";

  const select = document.createElement("select");
  select.className = "choice-set__select";
  select.dataset.action = "switch-set";
  select.setAttribute("aria-label", "表示するセット");

  for (const set of stateToRender.sets) {
    const option = document.createElement("option");
    option.value = set.id;
    option.textContent = set.name;
    option.selected = set.id === stateToRender.activeSetId;
    select.append(option);
  }

  const nameInput = document.createElement("input");
  nameInput.className = "choice-set__name";
  nameInput.dataset.action = "rename-set";
  nameInput.dataset.setId = activeSet.id;
  nameInput.value = activeSet.name;
  nameInput.maxLength = 24;
  nameInput.setAttribute("aria-label", "セット名");

  const addButton = document.createElement("button");
  addButton.type = "button";
  addButton.className = "choice-set__add";
  addButton.dataset.action = "add-set";
  addButton.textContent = "セット追加";

  switcher.append(label, select, nameInput, addButton);
  return switcher;
}

function renderEditor(stateToRender: ChoiceBoardState): HTMLElement {
  const activeSet = getActiveChoiceSet(stateToRender);
  const editor = document.createElement("section");
  editor.className = "choice-editor";
  editor.setAttribute("aria-label", "カード編集");

  const heading = document.createElement("h4");
  heading.className = "choice-editor__heading";
  heading.textContent = "カード編集";

  const list = document.createElement("div");
  list.className = "choice-editor__list";

  for (const choice of activeSet.choices) {
    const row = document.createElement("div");
    row.className = "choice-editor__row";

    const emojiInput = document.createElement("input");
    emojiInput.className = "choice-editor__emoji-input";
    emojiInput.dataset.action = "update";
    emojiInput.dataset.choiceId = choice.id;
    emojiInput.dataset.field = "emoji";
    emojiInput.value = choice.emoji;
    emojiInput.maxLength = 8;
    emojiInput.setAttribute("aria-label", `${choice.label}の絵文字`);

    const labelInput = document.createElement("input");
    labelInput.className = "choice-editor__label-input";
    labelInput.dataset.action = "update";
    labelInput.dataset.choiceId = choice.id;
    labelInput.dataset.field = "label";
    labelInput.value = choice.label;
    labelInput.maxLength = 24;
    labelInput.setAttribute("aria-label", `${choice.label}のことば`);

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "choice-editor__delete";
    deleteButton.dataset.action = "delete";
    deleteButton.dataset.choiceId = choice.id;
    deleteButton.textContent = "削除";
    deleteButton.disabled = !canRemoveChoice(stateToRender);

    row.append(emojiInput, labelInput, deleteButton);
    list.append(row);
  }

  const addButton = document.createElement("button");
  addButton.type = "button";
  addButton.className = "choice-editor__add";
  addButton.dataset.action = "add";
  addButton.textContent = "カードを追加";
  addButton.disabled = !canAddChoice(stateToRender);

  const note = document.createElement("p");
  note.className = "choice-editor__note";
  note.textContent = `${minChoiceCards}〜${maxChoiceCards}枚まで`;

  editor.append(heading, list, addButton, note);
  return editor;
}

async function saveState(nextState: ChoiceBoardState): Promise<void> {
  state = nextState;
  render();
  await store.set(choiceBoardStorageKey, state);
}

function injectStyles(): void {
  const style = document.createElement("style");
  style.textContent = `
    body {
      margin: 0;
      color: #1f2933;
      background: #fffdf8;
    }

    .choice-board {
      display: grid;
      gap: 12px;
    }

    .choice-set {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 8px;
      align-items: center;
    }

    .choice-set__label {
      color: #52606d;
      font-size: 13px;
      font-weight: 700;
    }

    .choice-set__select,
    .choice-set__name,
    .choice-set__add {
      box-sizing: border-box;
      min-height: 34px;
      border: 1px solid #bcccdc;
      border-radius: 6px;
      background: #ffffff;
      color: #102a43;
      font: inherit;
    }

    .choice-set__select {
      min-width: 0;
    }

    .choice-set__name {
      grid-column: 1 / 2;
      width: 100%;
    }

    .choice-set__add {
      grid-column: 2 / 3;
      font-weight: 700;
      cursor: pointer;
    }

    .choice-board__cards {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }

    .choice-card {
      display: grid;
      min-height: 108px;
      padding: 12px 8px;
      border: 2px solid #d9e2ec;
      border-radius: 8px;
      background: #ffffff;
      color: inherit;
      font: inherit;
      place-items: center;
      cursor: pointer;
    }

    .choice-card:focus-visible {
      outline: 3px solid #2f80ed;
      outline-offset: 2px;
    }

    .choice-card--selected {
      border-color: #2f80ed;
      background: #edf7ff;
      box-shadow: 0 0 0 3px #d5ebff;
    }

    .choice-card__emoji {
      font-size: 44px;
      line-height: 1;
    }

    .choice-card__label {
      font-size: 16px;
      font-weight: 700;
    }

    .confirmation {
      display: grid;
      min-height: 116px;
      padding: 14px;
      border: 2px dashed #bcccdc;
      border-radius: 8px;
      background: #f8fafc;
      color: #52606d;
      font-size: 18px;
      font-weight: 700;
      place-items: center;
      text-align: center;
    }

    .confirmation--selected {
      border-style: solid;
      border-color: #80b7e8;
      background: #eff8ff;
      animation: confirmation-pop 360ms ease-out both;
    }

    .confirmation__emoji {
      font-size: 76px;
      line-height: 1;
      animation: confirmation-emoji-pop 420ms ease-out both;
    }

    .confirmation__label {
      color: #102a43;
      font-size: 24px;
    }

    @keyframes confirmation-pop {
      0% {
        opacity: 0.76;
        transform: scale(0.94);
      }
      70% {
        transform: scale(1.02);
      }
      100% {
        opacity: 1;
        transform: scale(1);
      }
    }

    @keyframes confirmation-emoji-pop {
      0% {
        transform: scale(0.72);
      }
      72% {
        transform: scale(1.08);
      }
      100% {
        transform: scale(1);
      }
    }

    .choice-editor {
      display: grid;
      gap: 8px;
      padding-top: 4px;
    }

    .choice-editor__heading {
      margin: 0;
      font-size: 14px;
    }

    .choice-editor__list {
      display: grid;
      gap: 8px;
    }

    .choice-editor__row {
      display: grid;
      grid-template-columns: 48px minmax(0, 1fr) auto;
      gap: 6px;
      align-items: center;
    }

    .choice-editor input {
      box-sizing: border-box;
      width: 100%;
      min-height: 34px;
      border: 1px solid #bcccdc;
      border-radius: 6px;
      color: #102a43;
      font: inherit;
    }

    .choice-editor__emoji-input {
      text-align: center;
    }

    .choice-editor button {
      min-height: 34px;
      border: 1px solid #9fb3c8;
      border-radius: 6px;
      background: #ffffff;
      color: #102a43;
      font: inherit;
      font-weight: 700;
      cursor: pointer;
    }

    .choice-editor button:disabled {
      color: #829ab1;
      cursor: not-allowed;
    }

    .choice-editor__note {
      margin: 0;
      color: #627d98;
      font-size: 12px;
    }

    @media (prefers-reduced-motion: reduce) {
      .confirmation--selected,
      .confirmation__emoji {
        animation: none;
      }
    }
  `;
  document.head.append(style);
}

app?.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const actionButton = target.closest<HTMLButtonElement>("[data-action]");
  if (actionButton?.dataset.action === "add-set") {
    await saveState(addChoiceSet(state));
    return;
  }

  if (actionButton?.dataset.action === "add") {
    await saveState(addChoice(state, { emoji: "⭐", label: "あたらしい" }));
    return;
  }

  if (actionButton?.dataset.action === "delete") {
    const choiceId = actionButton.dataset.choiceId;
    if (!choiceId) return;

    await saveState(removeChoice(state, choiceId));
    return;
  }

  const card = target.closest<HTMLButtonElement>(".choice-card");
  const choiceId = card?.dataset.choiceId;
  if (!choiceId) return;

  await saveState(selectChoice(state, choiceId));
});

app?.addEventListener("change", async (event) => {
  const target = event.target;
  if (target instanceof HTMLSelectElement && target.dataset.action === "switch-set") {
    await saveState(switchChoiceSet(state, target.value));
    return;
  }

  if (!(target instanceof HTMLInputElement)) return;

  if (target.dataset.action === "rename-set") {
    const setId = target.dataset.setId;
    if (!setId) return;

    await saveState(updateChoiceSetName(state, setId, target.value));
    return;
  }

  if (target.dataset.action !== "update") return;

  const choiceId = target.dataset.choiceId;
  if (!choiceId) return;

  const activeSet = getActiveChoiceSet(state);
  const choice = activeSet.choices.find((item) => item.id === choiceId);
  if (!choice) return;

  const nextEmoji = target.dataset.field === "emoji" ? target.value : choice.emoji;
  const nextLabel = target.dataset.field === "label" ? target.value : choice.label;
  await saveState(updateChoice(state, choiceId, { emoji: nextEmoji, label: nextLabel }));
});

async function initialize(): Promise<void> {
  state = createChoiceBoardState(await store.get<ChoiceBoardState>(choiceBoardStorageKey));
  render();
}

injectStyles();
void initialize();
