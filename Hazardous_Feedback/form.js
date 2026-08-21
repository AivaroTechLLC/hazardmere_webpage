const SENTRY_DSN = "https://ae8b5533be876de1a655daf35057dc91@o4511921747197952.ingest.us.sentry.io/4511921751916544";
const form = document.querySelector("#feedback-form");
const statusText = document.querySelector("#form-status");
const submitButton = form.querySelector("button[type='submit']");
const startedAt = Date.now();
const BROWSER_ID_KEY = "hazardousEmploymentFeedbackBrowserId";
const SUBMITTED_KEY = "hazardousEmploymentFeedbackSubmitted";

function createBrowserId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `browser-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getOrCreateBrowserId() {
  try {
    const existingId = localStorage.getItem(BROWSER_ID_KEY);
    if (existingId) return existingId;

    const newId = createBrowserId();
    localStorage.setItem(BROWSER_ID_KEY, newId);
    return newId;
  } catch {
    // Privacy modes may disable local storage. IP collection still provides
    // a duplicate-audit signal in Sentry for these submissions.
    return createBrowserId();
  }
}

function hasSubmitted() {
  try {
    return Boolean(localStorage.getItem(SUBMITTED_KEY));
  } catch {
    return false;
  }
}

function rememberSubmission(eventId) {
  try {
    localStorage.setItem(SUBMITTED_KEY, JSON.stringify({
      submittedAt: new Date().toISOString(),
      eventId,
    }));
  } catch {
    // A successful response should not be shown as failed merely because
    // the browser refused local storage.
  }
}

const browserId = getOrCreateBrowserId();

Sentry.init({
  dsn: SENTRY_DSN,
  environment: "playtest-feedback-website",
  defaultIntegrations: false,
  // This instructs Sentry to infer the sender's IP address. The form discloses
  // that collection and uses it only for duplicate-response verification.
  sendDefaultPii: true,
});

Sentry.setUser({ id: browserId });

if (hasSubmitted()) {
  form.innerHTML = "<section class='already-submitted'><h2>Feedback already submitted</h2><p>This browser has already sent a playtest response. Only one response is accepted per playtester.</p></section>";
}

function answer(data, key) {
  return String(data.get(key) || "").trim() || "No answer";
}

function selectedAnswers(data, key) {
  return data.getAll(key).map(String).join(", ") || "None selected";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (hasSubmitted()) {
    form.innerHTML = "<section class='already-submitted'><h2>Feedback already submitted</h2><p>This browser has already sent a playtest response. Only one response is accepted per playtester.</p></section>";
    return;
  }

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
    browserId,
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
    "",
    `Anonymous browser ID: ${report.browserId}`,
  ].join("\n");

  submitButton.disabled = true;
  statusText.textContent = "Submitting…";

  try {
    let eventId;

    Sentry.withScope((scope) => {
      scope.setTag("feedback_source", "web_playtest_questionnaire");
      scope.setTag("game", "hazardous_employment");
      scope.setTag("duplicate_guard", "ip_and_browser_id");
      scope.setTag("participant_browser_id", browserId);
      scope.setFingerprint(["playtest-questionnaire", report.build]);
      scope.setExtras(report);

      // Mirror the Unity F11 flow: create an informational event, then attach
      // the feedback to it so the response appears in Issues and User Feedback.
      eventId = Sentry.captureMessage("Player playtest questionnaire submitted", "info");
      Sentry.captureFeedback({
        name: answer(data, "name") === "No answer" ? undefined : answer(data, "name"),
        email: answer(data, "email") === "No answer" ? undefined : answer(data, "email"),
        message,
        associatedEventId: eventId,
      });
    });

    if (!(await Sentry.flush(5000))) throw new Error("Sentry delivery timed out");
    rememberSubmission(eventId);
    form.innerHTML = "<h2>Thank you for the feedback.</h2><p>Your response was submitted successfully.</p>";
  } catch (error) {
    statusText.textContent = "The form could not submit. Please wait a moment and try again.";
    submitButton.disabled = false;
  }
});
