import {
  addChoice,
  addChoiceSet,
  canAddChoice,
  canAddChoiceSet,
  canRemoveChoice,
  ChoiceBoardState,
  ChoiceCard,
  ChoiceBoardText,
  canUnlockParentMode,
  canRestoreRemovedChoice,
  choiceBoardStorageKey,
  createChoiceBoardState,
  createInitialChoiceBoardState,
  createRemovedChoiceSnapshot,
  getActiveChoiceSet,
  getChoiceConfirmation,
  getChoiceCardLimit,
  getChoiceNavigationTarget,
  getPremiumGate,
  hasActiveChoices,
  minChoiceCards,
  removeChoice,
  RemovedChoiceSnapshot,
  restoreRemovedChoice,
  selectChoice,
  startPremiumTrial,
  switchToChildMode,
  switchToParentMode,
  switchChoiceSet,
  StoredChoiceBoardState,
  updateParentPin,
  updateChoice,
  updateChoiceSetName,
} from "./core/choiceBoard";
import { store } from "./storage";

const app = document.querySelector<HTMLDivElement>("#app");
const messages = createLocalizedChoiceBoardText();

let state = createInitialChoiceBoardState(messages);
let parentUnlockError = "";
let pendingChoiceFocusId: string | null = null;
let pendingDeleteChoiceId: string | null = null;
let lastRemovedChoice: RemovedChoiceSnapshot | null = null;

function t(key: string, substitutions?: string | string[]): string {
  const message = chrome.i18n.getMessage(key, substitutions);
  return message || key;
}

function createLocalizedChoiceBoardText(): ChoiceBoardText {
  return {
    defaultChoices: [
      { id: "apple", emoji: "🍎", label: t("defaultChoiceApple") },
      { id: "banana", emoji: "🍌", label: t("defaultChoiceBanana") },
    ],
    firstSetName: t("defaultSetSnacks"),
    secondSetName: t("defaultSetPlay"),
    setNamePrefix: t("defaultSetPrefix"),
    fallbackChoiceLabel: t("fallbackChoiceLabel"),
    fallbackChoiceSetName: t("fallbackChoiceSetName"),
    promptLabel: t("confirmationPrompt"),
    confirmationTemplate: t("confirmationTemplate", "{label}"),
  };
}

function renderChoiceCard(
  choice: ChoiceCard,
  selectedChoiceId: string | null,
): HTMLButtonElement {
  const isSelected = choice.id === selectedChoiceId;
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.choiceId = choice.id;
  button.className = isSelected ? "choice-card choice-card--selected" : "choice-card";
  button.setAttribute(
    "aria-label",
    isSelected ? t("choiceCardSelectedAria", choice.label) : t("choiceCardAria", choice.label),
  );
  button.setAttribute("aria-pressed", String(isSelected));

  const emoji = document.createElement("span");
  emoji.className = "choice-card__emoji";
  emoji.setAttribute("aria-hidden", "true");
  emoji.textContent = choice.emoji;

  const label = document.createElement("span");
  label.className = "choice-card__label";
  label.textContent = choice.label;

  if (isSelected) {
    const selectedMarker = document.createElement("span");
    selectedMarker.className = "choice-card__selected-marker";
    selectedMarker.textContent = t("selectedMarker");
    button.append(selectedMarker);
  }

  button.append(emoji, label);
  return button;
}

function renderConfirmation(stateToRender: ChoiceBoardState): HTMLElement {
  const confirmationModel = getChoiceConfirmation(stateToRender, messages);
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
  shell.className =
    state.mode === "child" ? "choice-board choice-board--child" : "choice-board";

  const choices = document.createElement("div");
  choices.className = "choice-board__cards";
  choices.setAttribute("role", "group");
  choices.setAttribute("aria-label", t("choiceCardsAria"));

  if (hasActiveChoices(state)) {
    for (const choice of activeSet.choices) {
      choices.append(renderChoiceCard(choice, activeSet.selectedChoiceId));
    }
  } else {
    const empty = document.createElement("p");
    empty.className = "choice-board__empty";
    empty.setAttribute("role", "status");
    empty.textContent =
      state.mode === "parent" ? t("emptyChoicesParent") : t("emptyChoicesChild");
    choices.append(empty);
  }

  shell.append(renderModeControls(state));

  if (state.mode === "parent") {
    shell.append(renderSetSwitcher(state));
  }

  shell.append(choices, renderConfirmation(state));

  if (state.mode === "parent") {
    shell.append(renderPremiumGate(state));
    shell.append(renderEditor(state));
  }

  app.replaceChildren(shell);

  if (pendingChoiceFocusId) {
    Array.from(app.querySelectorAll<HTMLButtonElement>(".choice-card"))
      .find((card) => card.dataset.choiceId === pendingChoiceFocusId)
      ?.focus();
    pendingChoiceFocusId = null;
  }
}

function renderModeControls(stateToRender: ChoiceBoardState): HTMLElement {
  const controls = document.createElement("section");
  controls.className = "mode-controls";
  controls.setAttribute("aria-label", t("modeControlsAria"));

  const label = document.createElement("div");
  label.className = "mode-controls__label";
  label.textContent =
    stateToRender.mode === "parent" ? t("parentModeLabel") : t("childModeLabel");

  if (stateToRender.mode === "parent") {
    const pinInput = document.createElement("input");
    pinInput.className = "mode-controls__pin";
    pinInput.dataset.action = "update-pin";
    pinInput.inputMode = "numeric";
    pinInput.type = "password";
    pinInput.value = stateToRender.parentPin;
    pinInput.maxLength = 8;
    pinInput.setAttribute("aria-label", t("parentPinAria"));

    const childModeButton = document.createElement("button");
    childModeButton.type = "button";
    childModeButton.className = "mode-controls__button";
    childModeButton.dataset.action = "switch-child";
    childModeButton.textContent = t("childModeButton");

    controls.append(label, pinInput, childModeButton);
    return controls;
  }

  const unlockInput = document.createElement("input");
  unlockInput.className = "mode-controls__pin";
  unlockInput.dataset.action = "unlock-pin";
  unlockInput.inputMode = "numeric";
  unlockInput.type = "password";
  unlockInput.maxLength = 8;
  unlockInput.setAttribute("aria-label", t("unlockParentPinAria"));

  const parentModeButton = document.createElement("button");
  parentModeButton.type = "button";
  parentModeButton.className = "mode-controls__button";
  parentModeButton.dataset.action = "unlock-parent";
  parentModeButton.textContent = t("parentModeButton");

  controls.append(label, unlockInput, parentModeButton);

  if (parentUnlockError) {
    const error = document.createElement("p");
    error.className = "mode-controls__error";
    error.setAttribute("role", "status");
    error.textContent = parentUnlockError;
    controls.append(error);
  }

  return controls;
}

function renderSetSwitcher(stateToRender: ChoiceBoardState): HTMLElement {
  const activeSet = getActiveChoiceSet(stateToRender);
  const switcher = document.createElement("section");
  switcher.className = "choice-set";
  switcher.setAttribute("aria-label", t("setSwitcherAria"));

  const label = document.createElement("label");
  label.className = "choice-set__label";
  label.textContent = t("setLabel");

  const select = document.createElement("select");
  select.className = "choice-set__select";
  select.dataset.action = "switch-set";
  select.setAttribute("aria-label", t("setSelectAria"));

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
  nameInput.setAttribute("aria-label", t("setNameAria"));

  const addButton = document.createElement("button");
  addButton.type = "button";
  addButton.className = "choice-set__add";
  addButton.dataset.action = "add-set";
  addButton.textContent = t("addSetButton");
  addButton.disabled = !canAddChoiceSet(stateToRender);

  switcher.append(label, select, nameInput, addButton);
  return switcher;
}

function renderPremiumGate(stateToRender: ChoiceBoardState): HTMLElement {
  const premium = getPremiumGate(stateToRender);
  const gate = document.createElement("section");
  gate.className = "premium-gate";
  gate.setAttribute("aria-label", t("premiumGateAria"));

  const status = document.createElement("p");
  status.className = "premium-gate__status";

  if (premium.status === "premium") {
    status.textContent = t("premiumStatusPremium");
  } else if (premium.status === "trial" && premium.trialEndsAt !== null) {
    status.textContent = t("premiumStatusTrial", formatDate(premium.trialEndsAt));
  } else {
    status.textContent = t("premiumStatusFree");
  }

  const limits = document.createElement("p");
  limits.className = "premium-gate__limits";
  limits.textContent =
    premium.maxSets === null
      ? t("premiumLimitsPremium", String(premium.maxCards))
      : t("premiumLimitsFree", [String(premium.maxSets), String(premium.maxCards)]);

  const actions = document.createElement("div");
  actions.className = "premium-gate__actions";

  if (stateToRender.premium.trialStartedAt === null && premium.status === "free") {
    const trialButton = document.createElement("button");
    trialButton.type = "button";
    trialButton.className = "premium-gate__button";
    trialButton.dataset.action = "start-trial";
    trialButton.textContent = t("startTrialButton");
    actions.append(trialButton);
  }

  const checkoutLink = document.createElement("a");
  checkoutLink.className = "premium-gate__checkout";
  checkoutLink.href = premium.checkoutUrl;
  checkoutLink.target = "_blank";
  checkoutLink.rel = "noopener noreferrer";
  checkoutLink.textContent = t("checkoutButton");
  actions.append(checkoutLink);

  gate.append(status, limits, actions);
  return gate;
}

function renderEditor(stateToRender: ChoiceBoardState): HTMLElement {
  const activeSet = getActiveChoiceSet(stateToRender);
  const editor = document.createElement("section");
  editor.className = "choice-editor";
  editor.setAttribute("aria-label", t("cardEditorAria"));

  const heading = document.createElement("h4");
  heading.className = "choice-editor__heading";
  heading.textContent = t("cardEditorHeading");

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
    emojiInput.setAttribute("aria-label", t("choiceEmojiAria", choice.label));

    const labelInput = document.createElement("input");
    labelInput.className = "choice-editor__label-input";
    labelInput.dataset.action = "update";
    labelInput.dataset.choiceId = choice.id;
    labelInput.dataset.field = "label";
    labelInput.value = choice.label;
    labelInput.maxLength = 24;
    labelInput.setAttribute("aria-label", t("choiceLabelAria", choice.label));

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className =
      pendingDeleteChoiceId === choice.id
        ? "choice-editor__delete choice-editor__delete--confirm"
        : "choice-editor__delete";
    deleteButton.dataset.action = "delete";
    deleteButton.dataset.choiceId = choice.id;
    deleteButton.textContent =
      pendingDeleteChoiceId === choice.id ? t("confirmDeleteButton") : t("deleteButton");
    deleteButton.disabled = !canRemoveChoice(stateToRender);

    row.append(emojiInput, labelInput, deleteButton);

    if (pendingDeleteChoiceId === choice.id) {
      const cancelDeleteButton = document.createElement("button");
      cancelDeleteButton.type = "button";
      cancelDeleteButton.className = "choice-editor__cancel-delete";
      cancelDeleteButton.dataset.action = "cancel-delete";
      cancelDeleteButton.textContent = t("cancelDeleteButton");
      row.append(cancelDeleteButton);
    }

    list.append(row);
  }

  const addButton = document.createElement("button");
  addButton.type = "button";
  addButton.className = "choice-editor__add";
  addButton.dataset.action = "add";
  addButton.textContent = t("addCardButton");
  addButton.disabled = !canAddChoice(stateToRender);

  const note = document.createElement("p");
  note.className = "choice-editor__note";
  note.textContent = t("cardLimit", [
    String(minChoiceCards),
    String(getChoiceCardLimit(stateToRender)),
  ]);

  editor.append(heading, list);

  if (lastRemovedChoice) {
    const undo = document.createElement("div");
    undo.className = "choice-editor__undo";
    undo.setAttribute("role", "status");

    const undoMessage = document.createElement("span");
    undoMessage.textContent = t("cardDeletedStatus", lastRemovedChoice.choice.label);

    const undoButton = document.createElement("button");
    undoButton.type = "button";
    undoButton.className = "choice-editor__undo-button";
    undoButton.dataset.action = "undo-delete";
    undoButton.textContent = t("undoDeleteButton");
    undoButton.disabled = !canRestoreRemovedChoice(stateToRender, lastRemovedChoice);

    undo.append(undoMessage, undoButton);
    editor.append(undo);
  }

  editor.append(addButton, note);
  return editor;
}

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat(chrome.i18n.getUILanguage(), {
    month: "short",
    day: "numeric",
  }).format(new Date(timestamp));
}

async function saveState(nextState: ChoiceBoardState): Promise<void> {
  state = nextState;
  parentUnlockError = "";
  pendingDeleteChoiceId = null;
  render();
  await store.set(choiceBoardStorageKey, state);
}

function injectStyles(): void {
  const style = document.createElement("style");
  style.textContent = `
    body {
      box-sizing: border-box;
      width: 360px;
      margin: 0;
      padding: 14px;
      color: #25313b;
      background: #fff8ee;
      font-family:
        ui-rounded,
        "Hiragino Maru Gothic ProN",
        "Hiragino Sans",
        system-ui,
        sans-serif;
    }

    .choice-board {
      display: grid;
      gap: 14px;
    }

    .choice-board--child {
      gap: 16px;
    }

    .mode-controls {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 92px auto;
      gap: 8px;
      align-items: center;
    }

    .mode-controls__label {
      color: #102a43;
      font-size: 14px;
      font-weight: 700;
    }

    .mode-controls__pin,
    .mode-controls__button {
      box-sizing: border-box;
      min-height: 40px;
      border: 1px solid #c7d4df;
      border-radius: 12px;
      background: #ffffff;
      color: #102a43;
      font: inherit;
    }

    .mode-controls__pin {
      min-width: 0;
      width: 100%;
    }

    .mode-controls__button {
      padding: 0 12px;
      background: #fff3d6;
      font-weight: 700;
      cursor: pointer;
    }

    .mode-controls__error {
      grid-column: 1 / -1;
      margin: 0;
      color: #8f1d14;
      font-size: 12px;
      font-weight: 700;
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
      min-height: 40px;
      border: 1px solid #c7d4df;
      border-radius: 12px;
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
      padding: 0 12px;
      background: #e8f7f0;
      font-weight: 700;
      cursor: pointer;
    }

    .choice-set__add:disabled {
      color: #829ab1;
      cursor: not-allowed;
    }

    .choice-board__cards {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }

    .choice-board__empty {
      grid-column: 1 / -1;
      margin: 0;
      min-height: 120px;
      display: grid;
      place-items: center;
      padding: 16px;
      border: 3px dashed #d7b06e;
      border-radius: 22px;
      background: #fffef9;
      color: #455f79;
      font-size: 16px;
      font-weight: 700;
      line-height: 1.4;
      text-align: center;
    }

    .choice-card {
      position: relative;
      display: grid;
      gap: 8px;
      min-height: 132px;
      padding: 16px 10px;
      border: 3px solid #f0d3aa;
      border-radius: 22px;
      background: #ffffff;
      color: inherit;
      font: inherit;
      place-items: center;
      text-align: center;
      box-shadow: 0 6px 0 #f3dfc4;
      cursor: pointer;
    }

    .choice-card:focus-visible {
      outline: 4px solid #4f86f7;
      outline-offset: 3px;
    }

    .choice-card:hover {
      background: #fffaf2;
    }

    .choice-card:active {
      transform: translateY(2px);
      box-shadow: 0 4px 0 #f3dfc4;
    }

    .choice-card--selected {
      border-color: #2457c5;
      background: #eef7ff;
      box-shadow: 0 6px 0 #b7d1ff, 0 0 0 4px #dcecff;
    }

    .choice-card__selected-marker {
      position: absolute;
      top: 8px;
      right: 8px;
      min-width: 28px;
      min-height: 28px;
      border: 2px solid #2457c5;
      border-radius: 999px;
      background: #ffffff;
      color: #173f98;
      font-size: 16px;
      font-weight: 800;
      line-height: 24px;
    }

    .choice-card__emoji {
      font-size: 58px;
      line-height: 1;
    }

    .choice-card__label {
      color: #243b53;
      font-size: 18px;
      font-weight: 700;
      line-height: 1.25;
    }

    .confirmation {
      display: grid;
      min-height: 132px;
      padding: 16px;
      border: 3px dashed #e0bd7f;
      border-radius: 22px;
      background: #fffef9;
      color: #4b5563;
      font-size: 18px;
      font-weight: 700;
      place-items: center;
      text-align: center;
    }

    .confirmation--selected {
      border-style: solid;
      border-color: #2f8f6b;
      background: #effbf5;
      animation: confirmation-pop 360ms ease-out both;
    }

    .confirmation__emoji {
      font-size: 88px;
      line-height: 1;
      animation: confirmation-emoji-pop 420ms ease-out both;
    }

    .confirmation__label {
      color: #12344d;
      font-size: 26px;
      line-height: 1.25;
    }

    .choice-board--child .choice-card {
      min-height: 150px;
      padding: 18px 12px;
    }

    .choice-board--child .choice-card__emoji {
      font-size: 66px;
    }

    .choice-board--child .choice-card__label {
      font-size: 20px;
    }

    .choice-board--child .confirmation {
      min-height: 150px;
    }

    .premium-gate {
      display: grid;
      gap: 6px;
      padding: 10px;
      border: 1px solid #d9e2ec;
      border-radius: 12px;
      background: #ffffff;
    }

    .premium-gate__status,
    .premium-gate__limits {
      margin: 0;
      font-size: 12px;
    }

    .premium-gate__status {
      color: #102a43;
      font-weight: 700;
    }

    .premium-gate__limits {
      color: #3f5368;
    }

    .premium-gate__actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .premium-gate__button,
    .premium-gate__checkout {
      box-sizing: border-box;
      min-height: 38px;
      padding: 6px 10px;
      border: 1px solid #9fb3c8;
      border-radius: 12px;
      background: #f8fbff;
      color: #102a43;
      font: inherit;
      font-size: 13px;
      font-weight: 700;
      text-decoration: none;
      cursor: pointer;
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
      grid-template-columns: 48px minmax(0, 1fr) auto auto;
      gap: 6px;
      align-items: center;
    }

    .choice-editor input {
      box-sizing: border-box;
      width: 100%;
      min-height: 34px;
      border: 1px solid #bcccdc;
      border-radius: 12px;
      color: #102a43;
      font: inherit;
    }

    .choice-editor__emoji-input {
      text-align: center;
    }

    .choice-editor button {
      min-height: 34px;
      border: 1px solid #9fb3c8;
      border-radius: 12px;
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

    .choice-editor__delete--confirm {
      border-color: #b42318;
      background: #fff1f0;
      color: #8f1d14;
    }

    .choice-editor__undo {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      justify-content: space-between;
      padding: 8px 10px;
      border: 1px solid #c7d4df;
      border-radius: 12px;
      background: #f8fbff;
      color: #243b53;
      font-size: 12px;
      font-weight: 700;
    }

    .choice-editor__undo-button {
      padding: 0 10px;
    }

    .choice-editor__note {
      margin: 0;
      color: #455f79;
      font-size: 12px;
    }

    button:focus-visible,
    input:focus-visible,
    select:focus-visible,
    a:focus-visible {
      outline: 3px solid #2457c5;
      outline-offset: 2px;
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
  if (actionButton?.dataset.action === "switch-child") {
    await saveState(switchToChildMode(state));
    return;
  }

  if (actionButton?.dataset.action === "unlock-parent") {
    const pinInput = app.querySelector<HTMLInputElement>("[data-action='unlock-pin']");
    const pin = pinInput?.value ?? "";

    if (!canUnlockParentMode(state, pin)) {
      parentUnlockError = t("pinError");
      render();
      return;
    }

    await saveState(switchToParentMode(state, pin));
    return;
  }

  if (actionButton?.dataset.action === "add-set") {
    await saveState(addChoiceSet(state, messages));
    return;
  }

  if (actionButton?.dataset.action === "start-trial") {
    await saveState(startPremiumTrial(state));
    return;
  }

  if (actionButton?.dataset.action === "add") {
    lastRemovedChoice = null;
    await saveState(addChoice(state, { emoji: "⭐", label: t("newChoiceLabel") }, messages));
    return;
  }

  if (actionButton?.dataset.action === "cancel-delete") {
    pendingDeleteChoiceId = null;
    render();
    return;
  }

  if (actionButton?.dataset.action === "undo-delete") {
    const restoredState = restoreRemovedChoice(state, lastRemovedChoice);
    lastRemovedChoice = null;
    await saveState(restoredState);
    return;
  }

  if (actionButton?.dataset.action === "delete") {
    const choiceId = actionButton.dataset.choiceId;
    if (!choiceId) return;

    if (pendingDeleteChoiceId !== choiceId) {
      pendingDeleteChoiceId = choiceId;
      render();
      return;
    }

    const removedChoice = createRemovedChoiceSnapshot(state, choiceId);
    if (!removedChoice) return;

    lastRemovedChoice = removedChoice;
    await saveState(removeChoice(state, choiceId));
    return;
  }

  const card = target.closest<HTMLButtonElement>(".choice-card");
  const choiceId = card?.dataset.choiceId;
  if (!choiceId) return;

  lastRemovedChoice = null;
  await saveState(selectChoice(state, choiceId));
});

app?.addEventListener("keydown", async (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const card = target.closest<HTMLButtonElement>(".choice-card");
  const choiceId = card?.dataset.choiceId;
  if (!choiceId) return;

  const navigationKeys = new Map<string, "next" | "previous" | "first" | "last">([
    ["ArrowRight", "next"],
    ["ArrowDown", "next"],
    ["ArrowLeft", "previous"],
    ["ArrowUp", "previous"],
    ["Home", "first"],
    ["End", "last"],
  ]);
  const direction = navigationKeys.get(event.key);
  if (!direction) return;

  const nextChoiceId = getChoiceNavigationTarget(state, choiceId, direction);
  if (!nextChoiceId) return;

  event.preventDefault();
  pendingChoiceFocusId = nextChoiceId;
  await saveState(selectChoice(state, nextChoiceId));
});

app?.addEventListener("change", async (event) => {
  const target = event.target;
  if (target instanceof HTMLSelectElement && target.dataset.action === "switch-set") {
    lastRemovedChoice = null;
    await saveState(switchChoiceSet(state, target.value));
    return;
  }

  if (!(target instanceof HTMLInputElement)) return;

  if (target.dataset.action === "update-pin") {
    await saveState(updateParentPin(state, target.value));
    return;
  }

  if (target.dataset.action === "rename-set") {
    const setId = target.dataset.setId;
    if (!setId) return;

    lastRemovedChoice = null;
    await saveState(updateChoiceSetName(state, setId, target.value, messages));
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
  lastRemovedChoice = null;
  await saveState(updateChoice(state, choiceId, { emoji: nextEmoji, label: nextLabel }, messages));
});

async function initialize(): Promise<void> {
  const savedState = await store.get<StoredChoiceBoardState>(choiceBoardStorageKey);
  document.title = t("extName");
  state = createChoiceBoardState(savedState, messages);
  render();
}

injectStyles();
void initialize();
