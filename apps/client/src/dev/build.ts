/** A new element with a class and text. */
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text = ""): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

export function button(label: string, className: string, onClick: () => void, title = ""): HTMLButtonElement {
  const b = el("button", className, label);
  b.type = "button";
  b.title = title;
  b.addEventListener("click", onClick);
  return b;
}
