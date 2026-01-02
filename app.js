const STORAGE_KEY = "checkin-items";

const form = document.querySelector("#checkin-form");
const checkinsContainer = document.querySelector("#checkins");
const template = document.querySelector("#checkin-template");
const statusFilter = document.querySelector("#status-filter");
const timeFilter = document.querySelector("#time-filter");
const labelFilter = document.querySelector("#label-filter");

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
    return JSON.parse(stored);
  } catch (error) {
    console.error("Failed to parse stored check-ins", error);
    return [];
  }
};

const saveCheckins = (checkins) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(checkins));
  } catch (error) {
    console.error("Failed to save check-ins", error);
    alert("Failed to save check-ins. Your device may be in private browsing mode or storage is full.");
  }
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
  const labelsContainer = node.querySelector(".checkin-labels");
  const statusPill = node.querySelector(".status-pill");
  const due = node.querySelector(".checkin-due");
  const last = node.querySelector(".checkin-last");
  const overdue = node.querySelector(".checkin-overdue");
  const checkinNow = node.querySelector(".checkin-now");
  const deleteButton = node.querySelector(".delete");

  const { state, overdueDays } = computeStatus(checkin);

  title.textContent = checkin.title;
  frequency.textContent = `Every ${checkin.frequencyValue} ${checkin.frequencyUnit}`;
  
  // Display labels
  if (checkin.labels && checkin.labels.length > 0) {
    const labelsSpan = document.createElement('div');
    labelsSpan.className = 'labels';
    checkin.labels.forEach(label => {
      const labelTag = document.createElement('span');
      labelTag.className = 'label-tag';
      labelTag.textContent = label;
      labelsSpan.appendChild(labelTag);
    });
    labelsContainer.appendChild(labelsSpan);
  }
  
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

const saveAndRender = () => {
  saveCheckins(checkins);
  renderCheckins();
};

const getUniqueLabels = () => {
  const labels = new Set();
  checkins.forEach(checkin => {
    if (checkin.labels) {
      checkin.labels.forEach(label => labels.add(label));
    }
  });
  return Array.from(labels).sort();
};

const updateLabelFilter = () => {
  const currentSelection = labelFilter.value;
  labelFilter.innerHTML = '<option value="all">All labels</option>';
  
  const labels = getUniqueLabels();
  labels.forEach(label => {
    const option = document.createElement('option');
    option.value = label;
    option.textContent = label;
    labelFilter.appendChild(option);
  });
  
  // Restore selection if it still exists
  if (labels.includes(currentSelection) || currentSelection === 'all') {
    labelFilter.value = currentSelection;
  }
};

const filterCheckins = () => {
  let filtered = [...checkins];
  
  // Status filter
  const statusValue = statusFilter.value;
  if (statusValue !== 'all') {
    filtered = filtered.filter(checkin => {
      const { state } = computeStatus(checkin);
      return state === statusValue;
    });
  }
  
  // Time filter
  const timeValue = timeFilter.value;
  if (timeValue !== 'all') {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    filtered = filtered.filter(checkin => {
      const dueDate = new Date(checkin.nextDueDate);
      const dueDateStart = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
      
      if (timeValue === 'today') {
        return dueDateStart.getTime() === today.getTime();
      } else if (timeValue === 'week') {
        const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
        return dueDateStart >= today && dueDateStart <= weekFromNow;
      } else if (timeValue === 'month') {
        const monthFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
        return dueDateStart >= today && dueDateStart <= monthFromNow;
      }
      return true;
    });
  }
  
  // Label filter
  const labelValue = labelFilter.value;
  if (labelValue !== 'all') {
    filtered = filtered.filter(checkin => 
      checkin.labels && checkin.labels.includes(labelValue)
    );
  }
  
  return filtered;
};

const renderCheckins = () => {
  checkinsContainer.innerHTML = "";
  updateLabelFilter();
  
  const filteredCheckins = filterCheckins();
  
  if (filteredCheckins.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = checkins.length === 0 
      ? "No check-ins yet. Add your first recurring check-in above."
      : "No check-ins match the current filters.";
    empty.classList.add("helper");
    checkinsContainer.appendChild(empty);
    return;
  }

  // Sort by status priority (red first, then yellow, then on time), then by due date
  filteredCheckins
    .sort((a, b) => {
      const { state: stateA } = computeStatus(a);
      const { state: stateB } = computeStatus(b);
      
      const priority = { red: 0, yellow: 1, ontime: 2 };
      const priorityA = priority[stateA];
      const priorityB = priority[stateB];
      
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      
      return new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime();
    })
    .forEach((checkin) => {
      checkinsContainer.appendChild(buildCheckinCard(checkin));
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
  const labelsInput = String(formData.get("labels") || "").trim();

  if (!title) {
    return;
  }

  if (redThresholdDays < yellowThresholdDays) {
    alert("Red threshold should be greater than or equal to the yellow threshold.");
    return;
  }

  // Parse labels
  const labels = labelsInput ? labelsInput.split(',').map(label => label.trim()).filter(label => label.length > 0) : [];

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
  saveAndRender();
});

const setDefaultDate = () => {
  const today = new Date();
  const dateInput = document.querySelector("#first-due-date");
  dateInput.valueAsDate = today;
};

setDefaultDate();
renderCheckins();

// Add event listeners for filters
statusFilter.addEventListener('change', renderCheckins);
timeFilter.addEventListener('change', renderCheckins);
labelFilter.addEventListener('change', renderCheckins);
