import {
  ChoiceBoardState,
  createInitialChoiceBoardState,
  getSelectedChoice,
  selectChoice,
} from "./core/choiceBoard";

const app = document.querySelector<HTMLDivElement>("#app");

let state = createInitialChoiceBoardState();

function renderChoiceCard(choice: ChoiceBoardState["choices"][number]): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.choiceId = choice.id;
  button.className = "choice-card";
  button.setAttribute("aria-label", choice.label);

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
  const selectedChoice = getSelectedChoice(stateToRender);
  const confirmation = document.createElement("section");
  confirmation.className = "confirmation";
  confirmation.setAttribute("aria-live", "polite");

  if (!selectedChoice) {
    confirmation.textContent = "カードをえらんでね";
    return confirmation;
  }

  const emoji = document.createElement("div");
  emoji.className = "confirmation__emoji";
  emoji.textContent = selectedChoice.emoji;

  const label = document.createElement("div");
  label.className = "confirmation__label";
  label.textContent = `${selectedChoice.label} にする`;

  confirmation.append(emoji, label);
  return confirmation;
}

function render(): void {
  if (!app) return;

  const shell = document.createElement("main");
  shell.className = "choice-board";

  const choices = document.createElement("div");
  choices.className = "choice-board__cards";

  for (const choice of state.choices) {
    choices.append(renderChoiceCard(choice));
  }

  shell.append(choices, renderConfirmation(state));
  app.replaceChildren(shell);
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

    .confirmation__emoji {
      font-size: 56px;
      line-height: 1;
    }

    .confirmation__label {
      color: #102a43;
      font-size: 20px;
    }
  `;
  document.head.append(style);
}

app?.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const card = target.closest<HTMLButtonElement>(".choice-card");
  const choiceId = card?.dataset.choiceId;
  if (!choiceId) return;

  state = selectChoice(state, choiceId);
  render();
});

injectStyles();
render();
