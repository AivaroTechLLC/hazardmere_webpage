const copyButtons = document.querySelectorAll("[data-copy-target]");
const copyStatus = document.querySelector(".copy-status");
let statusTimer;

function showStatus(message) {
  if (!copyStatus) return;
  copyStatus.textContent = message;
  copyStatus.classList.add("visible");
  window.clearTimeout(statusTimer);
  statusTimer = window.setTimeout(() => copyStatus.classList.remove("visible"), 1800);
}

copyButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    const target = document.getElementById(button.dataset.copyTarget);
    if (!target) return;

    try {
      await navigator.clipboard.writeText(target.innerText.trim());
      showStatus("Copied to clipboard");
    } catch {
      showStatus("Select the text to copy it");
    }
  });
});
