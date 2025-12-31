const STORAGE_KEY = "checkin-items";

const form = document.querySelector("#checkin-form");
const checkinsContainer = document.querySelector("#checkins");
const template = document.querySelector("#checkin-template");
const statusButtons = document.querySelectorAll("[data-status]");
const upcomingButtons = document.querySelectorAll("[data-upcoming]");
const labelFilter = document.querySelector("#label-filter");

const activeFilters = {
  status: "all",
  upcoming: "all",
  label: "all",
};

const formatDate = (date) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);

const parseDateInput = (value) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const addInterval = (date, value, unit) => {
  const next = new Date(date.getTime());
  if (unit === "months") {
    const dayOfMonth = next.getDate();
    next.setMonth(next.getMonth() + value);
    if (next.getDate() !== dayOfMonth) {
      next.setDate(0);
    }
    return next;
  }

  const multiplier = unit === "weeks" ? 7 : 1;
  next.setDate(next.getDate() + value * multiplier);
  return next;
};

const loadCheckins = () => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return [];
  }
  try {
    return JSON.parse(stored).map((checkin) => ({
      ...checkin,
      labels: Array.isArray(checkin.labels) ? checkin.labels : [],
    }));
  } catch (error) {
    console.error("Failed to parse stored check-ins", error);
    return [];
  }
};

const normalizeLabels = (rawLabels) =>
  Array.from(
    new Set(
      rawLabels
        .split(",")
        .map((label) => label.trim())
        .filter(Boolean),
    ),
  );

const saveCheckins = (checkins) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(checkins));
};

const computeStatus = (checkin) => {
  const dueDate = new Date(checkin.nextDueDate);
  const now = new Date();
  const msDiff = now.setHours(0, 0, 0, 0) - dueDate.setHours(0, 0, 0, 0);
  const overdueDays = Math.max(Math.floor(msDiff / (1000 * 60 * 60 * 24)), 0);

  if (overdueDays === 0) {
    return { state: "ontime", overdueDays };
  }
  if (overdueDays > checkin.redThresholdDays) {
    return { state: "red", overdueDays };
  }
  if (overdueDays <= checkin.yellowThresholdDays) {
    return { state: "yellow", overdueDays };
  }
  return { state: "red", overdueDays };
};

const buildCheckinCard = (checkin) => {
  const node = template.content.cloneNode(true);
  const card = node.querySelector(".checkin-card");
  const title = node.querySelector(".checkin-title");
  const frequency = node.querySelector(".checkin-frequency");
  const statusPill = node.querySelector(".status-pill");
  const due = node.querySelector(".checkin-due");
  const last = node.querySelector(".checkin-last");
  const overdue = node.querySelector(".checkin-overdue");
  const labelsContainer = node.querySelector(".checkin-labels");
  const checkinNow = node.querySelector(".checkin-now");
  const deleteButton = node.querySelector(".delete");

  const { state, overdueDays } = computeStatus(checkin);

  title.textContent = checkin.title;
  frequency.textContent = `Every ${checkin.frequencyValue} ${checkin.frequencyUnit}`;
  statusPill.textContent = state === "ontime" ? "On time" : state;
  statusPill.classList.add(state);

  const nextDueDate = new Date(checkin.nextDueDate);
  due.textContent = `Next due: ${formatDate(nextDueDate)}`;
  last.textContent = checkin.lastCheckInDate
    ? `Last check-in: ${formatDate(new Date(checkin.lastCheckInDate))}`
    : "No check-ins yet";
  overdue.textContent =
    overdueDays === 0
      ? "Not overdue"
      : `${overdueDays} day${overdueDays === 1 ? "" : "s"} overdue`;

  labelsContainer.innerHTML = "";
  if (checkin.labels.length > 0) {
    checkin.labels.forEach((label) => {
      const pill = document.createElement("span");
      pill.classList.add("label-pill");
      pill.textContent = label;
      labelsContainer.appendChild(pill);
    });
  } else {
    const empty = document.createElement("span");
    empty.classList.add("helper");
    empty.textContent = "No labels";
    labelsContainer.appendChild(empty);
  }

  checkinNow.addEventListener("click", () => {
    checkin.lastCheckInDate = new Date().toISOString();
    checkin.nextDueDate = addInterval(
      new Date(),
      checkin.frequencyValue,
      checkin.frequencyUnit,
    ).toISOString();
    saveAndRender();
  });

  deleteButton.addEventListener("click", () => {
    checkins = checkins.filter((item) => item.id !== checkin.id);
    saveAndRender();
  });

  card.dataset.id = checkin.id;
  return node;
};

let checkins = loadCheckins();

const updateLabelFilterOptions = () => {
  const labels = Array.from(
    new Set(checkins.flatMap((checkin) => checkin.labels)),
  ).sort((a, b) => a.localeCompare(b));
  labelFilter.innerHTML = '<option value="all">All labels</option>';
  labels.forEach((label) => {
    const option = document.createElement("option");
    option.value = label;
    option.textContent = label;
    labelFilter.appendChild(option);
  });
};

const saveAndRender = () => {
  saveCheckins(checkins);
  updateLabelFilterOptions();
  renderCheckins();
};

const isWithinUpcomingRange = (checkin, upcomingRange) => {
  if (upcomingRange === "all") {
    return true;
  }
  const now = new Date();
  const due = new Date(checkin.nextDueDate);
  const dayMs = 1000 * 60 * 60 * 24;
  const diffDays = Math.ceil((due - now) / dayMs);
  if (diffDays < 0) {
    return false;
  }
  if (upcomingRange === "day") {
    return diffDays <= 1;
  }
  if (upcomingRange === "week") {
    return diffDays <= 7;
  }
  return diffDays <= 30;
};

const statusPriority = {
  red: 0,
  yellow: 1,
  ontime: 2,
};

const renderCheckins = () => {
  checkinsContainer.innerHTML = "";
  if (checkins.length === 0) {
    const empty = document.createElement("p");
    empty.textContent =
      "No check-ins yet. Add your first recurring check-in above.";
    empty.classList.add("helper");
    checkinsContainer.appendChild(empty);
    return;
  }

  checkins
    .map((checkin) => ({
      checkin,
      status: computeStatus(checkin),
    }))
    .filter(({ checkin, status }) => {
      if (activeFilters.status !== "all" && status.state !== activeFilters.status) {
        return false;
      }
      if (
        activeFilters.label !== "all" &&
        !checkin.labels.includes(activeFilters.label)
      ) {
        return false;
      }
      return isWithinUpcomingRange(checkin, activeFilters.upcoming);
    })
    .sort((a, b) => {
      const statusDiff =
        statusPriority[a.status.state] - statusPriority[b.status.state];
      if (statusDiff !== 0) {
        return statusDiff;
      }
      return new Date(a.checkin.nextDueDate) - new Date(b.checkin.nextDueDate);
    })
    .forEach((checkin) => {
      checkinsContainer.appendChild(buildCheckinCard(checkin.checkin));
    });
};

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(form);
  const title = String(formData.get("title")).trim();
  const frequencyValue = Number(formData.get("frequency-value"));
  const frequencyUnit = String(formData.get("frequency-unit"));
  const firstDueDate = parseDateInput(String(formData.get("first-due-date")));
  const yellowThresholdDays = Number(formData.get("yellow-threshold"));
  const redThresholdDays = Number(formData.get("red-threshold"));
  const labels = normalizeLabels(String(formData.get("labels") || ""));

  if (!title) {
    return;
  }

  if (redThresholdDays < yellowThresholdDays) {
    alert("Red threshold should be greater than or equal to the yellow threshold.");
    return;
  }

  const newCheckin = {
    id: crypto.randomUUID(),
    title,
    frequencyValue,
    frequencyUnit,
    nextDueDate: firstDueDate.toISOString(),
    lastCheckInDate: null,
    yellowThresholdDays,
    redThresholdDays,
    labels,
  };

  checkins.unshift(newCheckin);
  form.reset();
  document.querySelector("#frequency-value").value = 1;
  document.querySelector("#frequency-unit").value = "months";
  document.querySelector("#yellow-threshold").value = 14;
  document.querySelector("#red-threshold").value = 14;
  document.querySelector("#first-due-date").valueAsDate = new Date();
  document.querySelector("#labels").value = "";
  saveAndRender();
});

statusButtons.forEach((button) => {
  button.addEventListener("click", () => {
    statusButtons.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    activeFilters.status = button.dataset.status;
    renderCheckins();
  });
});

upcomingButtons.forEach((button) => {
  button.addEventListener("click", () => {
    upcomingButtons.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    activeFilters.upcoming = button.dataset.upcoming;
    renderCheckins();
  });
});

labelFilter.addEventListener("change", (event) => {
  activeFilters.label = event.target.value;
  renderCheckins();
});

const setDefaultDate = () => {
  const today = new Date();
  const dateInput = document.querySelector("#first-due-date");
  dateInput.valueAsDate = today;
};

setDefaultDate();
updateLabelFilterOptions();
renderCheckins();
