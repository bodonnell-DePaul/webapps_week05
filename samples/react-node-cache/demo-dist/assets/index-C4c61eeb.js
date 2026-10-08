// Stand-in for the bundle Vite emits. The hash in the filename is what makes
// "Cache-Control: max-age=31536000, immutable" safe for this file.
const list = document.getElementById("services");
const response = await fetch("/api/status");
const { services } = await response.json();
list.replaceChildren(...services.map(({ id, state }) => {
  const item = document.createElement("li");
  item.textContent = `${id}: ${state}`;
  return item;
}));
