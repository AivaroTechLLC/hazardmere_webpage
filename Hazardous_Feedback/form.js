const SENTRY_DSN = "https://ae8b5533be876de1a655daf35057dc91@o4511921747197952.ingest.us.sentry.io/4511921751916544";
const form = document.querySelector("#feedback-form");
const statusText = document.querySelector("#form-status");
const submitButton = form.querySelector("button[type='submit']");
const startedAt = Date.now();

Sentry.init({
  dsn: SENTRY_DSN,
  environment: "playtest-feedback-website",
  defaultIntegrations: false,
  sendDefaultPii: false,
});

function answer(data, key) {
  return String(data.get(key) || "").trim() || "No answer";
}

function selectedAnswers(data, key) {
  return data.getAll(key).map(String).join(", ") || "None selected";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(form);

  // Quietly discard obvious automated submissions.
  if (answer(data, "company") !== "No answer" || Date.now() - startedAt < 8000) {
    form.innerHTML = "<h2>Thank you for the feedback.</h2><p>Your response was submitted.</p>";
    return;
  }

  const report = {
    build: answer(data, "build"),
    duration: answer(data, "duration"),
    ending: answer(data, "ending"),
    nextAction: selectedAnswers(data, "nextAction"),
    fullGameExpectation: answer(data, "fullGameExpectation"),
    contractReasoning: answer(data, "contractReasoning"),
    preparationImpact: answer(data, "preparationImpact"),
    memorableWorker: answer(data, "memorableWorker"),
    confusion: answer(data, "confusion"),
    fairness: answer(data, "fairness"),
    enjoyment: answer(data, "enjoyment"),
    returnIntent: answer(data, "returnIntent"),
    bugs: answer(data, "bugs"),
    protectOrChange: answer(data, "protectOrChange"),
  };

  const message = [
    "HAZARDOUS EMPLOYMENT — PLAYTEST DEBRIEF",
    "",
    `Build: ${report.build}`,
    `Time played: ${report.duration}`,
    `Session ending: ${report.ending}`,
    `Wanted to do next: ${report.nextAction}`,
    "",
    `WHAT THE FULL GAME SEEMS TO ADD\n${report.fullGameExpectation}`,
    "",
    `WHY THIS CONTRACT AND PARTY\n${report.contractReasoning}`,
    "",
    `PREPARATION CHOICE THAT MATTERED\n${report.preparationImpact}`,
    "",
    `MEMORABLE WORKER OR INCIDENT\n${report.memorableWorker}`,
    "",
    `CONFUSING, HIDDEN, OR HARD TO READ\n${report.confusion}`,
    "",
    `FAIRNESS AND RECOVERY\n${report.fairness}`,
    "",
    `Enjoyment: ${report.enjoyment}/5`,
    `Would return for another run: ${report.returnIntent}/5`,
    "",
    `BUGS OR TECHNICAL PROBLEMS\n${report.bugs}`,
    "",
    `ONE THING TO CHANGE OR PROTECT\n${report.protectOrChange}`,
  ].join("\n");

  submitButton.disabled = true;
  statusText.textContent = "Submitting…";

  try {
    Sentry.withScope((scope) => {
      scope.setTag("feedback_source", "web_playtest_questionnaire");
      scope.setTag("game", "hazardous_employment");
      scope.setFingerprint(["playtest-questionnaire", report.build]);
      scope.setExtras(report);

      // Mirror the Unity F11 flow: create an informational event, then attach
      // the feedback to it so the response appears in Issues and User Feedback.
      const eventId = Sentry.captureMessage("Player playtest questionnaire submitted", "info");
      Sentry.captureFeedback({
        name: answer(data, "name") === "No answer" ? undefined : answer(data, "name"),
        email: answer(data, "email") === "No answer" ? undefined : answer(data, "email"),
        message,
        associatedEventId: eventId,
      });
    });

    if (!(await Sentry.flush(5000))) throw new Error("Sentry delivery timed out");
    form.innerHTML = "<h2>Thank you for the feedback.</h2><p>Your response was submitted successfully.</p>";
  } catch (error) {
    statusText.textContent = "The form could not submit. Please wait a moment and try again.";
    submitButton.disabled = false;
  }
});
