const CHECKINS_STORAGE_KEY = "checkin-items";
const TASKS_STORAGE_KEY = "task-items";

// DOM Elements
const checkinForm = document.querySelector("#checkin-form");
const taskForm = document.querySelector("#task-form");
const checkinsContainer = document.querySelector("#checkins");
const tasksContainer = document.querySelector("#tasks");
const checkinTemplate = document.querySelector("#checkin-template");
const taskTemplate = document.querySelector("#task-template");
const searchInput = document.querySelector("#search-input");

// Modal elements
const checkinModal = document.querySelector("#checkin-modal");
const taskModal = document.querySelector("#task-modal");
const addCheckinBtn = document.querySelector("#add-checkin-btn");
const addTaskBtn = document.querySelector("#add-task-btn");
const closeCheckinModal = document.querySelector("#close-checkin-modal");
const closeTaskModal = document.querySelector("#close-task-modal");

// View switcher
const checkinsViewBtn = document.querySelector("#checkins-view-btn");
const tasksViewBtn = document.querySelector("#tasks-view-btn");
const checkinsView = document.querySelector("#checkins-view");
const tasksView = document.querySelector("#tasks-view");

// Swim lane elements
const lane1Container = document.querySelector("#lane1");
const lane2Container = document.querySelector("#lane2");
const lane1Select = document.querySelector("#lane1-select");
const lane2Select = document.querySelector("#lane2-select");

// Import/Export
const importBtn = document.querySelector("#import-btn");
const exportBtn = document.querySelector("#export-btn");
const importFile = document.querySelector("#import-file");

// State
let currentView = "checkins";
let checkins = [];
let tasks = [];
let searchTerm = "";

// Utility functions
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

// Storage functions
const loadCheckins = () => {
  const stored = localStorage.getItem(CHECKINS_STORAGE_KEY);
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

const loadTasks = () => {
  const stored = localStorage.getItem(TASKS_STORAGE_KEY);
  if (!stored) {
    return [];
  }
  try {
    return JSON.parse(stored);
  } catch (error) {
    console.error("Failed to parse stored tasks", error);
    return [];
  }
};

const saveCheckins = (checkins) => {
  try {
    localStorage.setItem(CHECKINS_STORAGE_KEY, JSON.stringify(checkins));
  } catch (error) {
    console.error("Failed to save check-ins", error);
    alert("Failed to save check-ins. Your device may be in private browsing mode or storage is full.");
  }
};

const saveTasks = (tasks) => {
  try {
    localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks));
  } catch (error) {
    console.error("Failed to save tasks", error);
    alert("Failed to save tasks. Your device may be in private browsing mode or storage is full.");
  }
};

// Check-in functions
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

const createCheckinCard = (checkin) => {
  const node = checkinTemplate.content.cloneNode(true);
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

  const { state, overdueDays } = getCheckinStatus(checkin);

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

// Task functions
const computeTaskStatus = (task) => {
  if (task.completed) {
    return { state: "completed", daysOld: 0 };
  }
  
  const createdDate = new Date(task.createdDate);
  const now = new Date();
  const msDiff = now - createdDate;
  const daysOld = Math.floor(msDiff / (1000 * 60 * 60 * 24));
  
  let state = "ontime";
  if (daysOld >= 14) {
    state = "red";
  } else if (daysOld >= 7) {
    state = "yellow";
  }
  
  return { state, daysOld };
};

const buildTaskCard = (task) => {
  const node = taskTemplate.content.cloneNode(true);
  const card = node.querySelector(".task-card");
  const title = node.querySelector(".task-title");
  const labelsContainer = node.querySelector(".task-labels");
  const statusPill = node.querySelector(".status-pill");
  const created = node.querySelector(".task-created");
  const age = node.querySelector(".task-age");
  const completeButton = node.querySelector(".complete-task");
  const deleteButton = node.querySelector(".delete");

  const { state, daysOld } = computeTaskStatus(task);

  title.textContent = task.title;
  
  // Display labels
  if (task.labels && task.labels.length > 0) {
    const labelsSpan = document.createElement('div');
    labelsSpan.className = 'labels';
    task.labels.forEach(label => {
      const labelTag = document.createElement('span');
      labelTag.className = 'label-tag';
      labelTag.textContent = label;
      labelsSpan.appendChild(labelTag);
    });
    labelsContainer.appendChild(labelsSpan);
  }
  
  statusPill.textContent = task.completed ? "Completed" : 
    state === "ontime" ? "Recent" : 
    state === "yellow" ? "1 week+" : "2 weeks+";
  statusPill.classList.add(state);
  
  if (task.completed) {
    card.classList.add("completed");
    completeButton.textContent = "Completed";
    completeButton.disabled = true;
  }

  created.textContent = `Created: ${formatDate(new Date(task.createdDate))}`;
  age.textContent = task.completed 
    ? `Completed on ${formatDate(new Date(task.completedDate))}`
    : `${daysOld} day${daysOld === 1 ? "" : "s"} old`;

  completeButton.addEventListener("click", () => {
    if (!task.completed) {
      task.completed = true;
      task.completedDate = new Date().toISOString();
      saveAndRender();
    }
  });

  deleteButton.addEventListener("click", () => {
    tasks = tasks.filter((item) => item.id !== task.id);
    saveAndRender();
  });

  card.dataset.id = task.id;
  return node;
};

// Label functions
const getUniqueLabels = (items) => {
  const labels = new Set();
  items.forEach(item => {
    if (item.labels) {
      item.labels.forEach(label => labels.add(label));
    }
  });
  return Array.from(labels).sort();
};

const getTopLabels = (items, count = 2) => {
  const labelCounts = {};
  items.forEach(item => {
    if (item.labels) {
      item.labels.forEach(label => {
        labelCounts[label] = (labelCounts[label] || 0) + 1;
      });
    }
  });
  
  return Object.entries(labelCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, count)
    .map(([label]) => label);
};

// Filter functions
const filterCheckins = () => {
  let filtered = [...checkins];
  
  // Search filter
  if (searchTerm) {
    filtered = filtered.filter(checkin => 
      checkin.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }
  
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

const filterTasks = () => {
  let filtered = [...tasks];
  
  // Search filter
  if (searchTerm) {
    filtered = filtered.filter(task => 
      task.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }
  
  // Status filter
  const statusValue = taskStatusFilter.value;
  if (statusValue !== 'all') {
    filtered = filtered.filter(task => {
      if (statusValue === 'completed') {
        return task.completed;
      } else if (statusValue === 'pending') {
        return !task.completed;
      }
      return true;
    });
  }
  
  // Label filter
  const labelValue = taskLabelFilter.value;
  if (labelValue !== 'all') {
    filtered = filtered.filter(task => 
      task.labels && task.labels.includes(labelValue)
    );
  }
  
  return filtered;
};

// Render functions
const updateLabelFilters = () => {
  // Update checkin label filter
  const currentCheckinSelection = labelFilter.value;
  labelFilter.innerHTML = '<option value="all">All labels</option>';
  
  const checkinLabels = getUniqueLabels(checkins);
  checkinLabels.forEach(label => {
    const option = document.createElement('option');
    option.value = label;
    option.textContent = label;
    labelFilter.appendChild(option);
  });
  
  if (checkinLabels.includes(currentCheckinSelection) || currentCheckinSelection === 'all') {
    labelFilter.value = currentCheckinSelection;
  }
  
  // Update task label filter
  const currentTaskSelection = taskLabelFilter.value;
  taskLabelFilter.innerHTML = '<option value="all">All labels</option>';
  
  const taskLabels = getUniqueLabels(tasks);
  taskLabels.forEach(label => {
    const option = document.createElement('option');
    option.value = label;
    option.textContent = label;
    taskLabelFilter.appendChild(option);
  });
  
  if (taskLabels.includes(currentTaskSelection) || currentTaskSelection === 'all') {
    taskLabelFilter.value = currentTaskSelection;
  }
};

const renderCheckins = () => {
  if (currentView === 'checkins') {
    renderSwimLanes();
  }
};

const renderTasks = () => {
  tasksContainer.innerHTML = "";
  updateLabelFilters();
  
  const filteredTasks = filterTasks();
  
  if (filteredTasks.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = tasks.length === 0 
      ? "No tasks yet. Add your first task."
      : "No tasks match the current filters.";
    empty.classList.add("helper");
    tasksContainer.appendChild(empty);
    return;
  }

  // Sort tasks: incomplete tasks by age (oldest first), then completed tasks
  filteredTasks
    .sort((a, b) => {
      if (a.completed !== b.completed) {
        return a.completed ? 1 : -1;
      }
      if (!a.completed && !b.completed) {
        return new Date(a.createdDate).getTime() - new Date(b.createdDate).getTime();
      }
      return new Date(b.completedDate || 0).getTime() - new Date(a.completedDate || 0).getTime();
    })
    .forEach((task) => {
      tasksContainer.appendChild(buildTaskCard(task));
    });
};

const render = () => {
  if (currentView === "checkins") {
    renderCheckins();
  } else {
    renderTasks();
  }
};

const saveAndRender = () => {
  saveCheckins(checkins);
  saveTasks(tasks);
  render();
};

// Modal functions
const openModal = (modal) => {
  modal.classList.add("show");
};

const closeModal = (modal) => {
  modal.classList.remove("show");
};

// View switching
const switchToView = (view) => {
  currentView = view;
  if (view === 'checkins') {
    checkinsView.style.display = 'block';
    tasksView.style.display = 'none';
    checkinsViewBtn.classList.add('active');
    tasksViewBtn.classList.remove('active');
  } else {
    checkinsView.style.display = 'none';
    tasksView.style.display = 'block';
    checkinsViewBtn.classList.remove('active');
    tasksViewBtn.classList.add('active');
  }
  render();
};

// Import/Export functions
const exportData = () => {
  const data = {
    checkins,
    tasks,
    exportDate: new Date().toISOString()
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `checkin-data-${formatDate(new Date()).replace(/\s+/g, "-")}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const importData = (file) => {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      
      if (data.checkins && Array.isArray(data.checkins)) {
        checkins = data.checkins;
        saveCheckins(checkins);
      }
      
      if (data.tasks && Array.isArray(data.tasks)) {
        tasks = data.tasks;
        saveTasks(tasks);
      }
      
      render();
      alert("Data imported successfully!");
    } catch (error) {
      console.error("Failed to import data", error);
      alert("Failed to import data. Please check the file format.");
    }
  };
  reader.readAsText(file);
};

// Event listeners
addCheckinBtn.addEventListener("click", () => openModal(checkinModal));
addTaskBtn.addEventListener("click", () => openModal(taskModal));
closeCheckinModal.addEventListener("click", () => closeModal(checkinModal));
closeTaskModal.addEventListener("click", () => closeModal(taskModal));

checkinsViewBtn.addEventListener("click", () => switchView("checkins"));
tasksViewBtn.addEventListener("click", () => switchView("tasks"));

exportBtn.addEventListener("click", exportData);
importBtn.addEventListener("click", () => importFile.click());
importFile.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) {
    importData(file);
  }
  e.target.value = ""; // Reset file input
});

searchInput.addEventListener("input", (e) => {
  searchTerm = e.target.value;
  render();
});

// Close modal when clicking outside
window.addEventListener("click", (e) => {
  if (e.target === checkinModal) {
    closeModal(checkinModal);
  }
  if (e.target === taskModal) {
    closeModal(taskModal);
  }
});

// Form submissions
checkinForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(checkinForm);
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
  checkinForm.reset();
  document.querySelector("#frequency-value").value = 1;
  document.querySelector("#frequency-unit").value = "months";
  document.querySelector("#yellow-threshold").value = 14;
  document.querySelector("#red-threshold").value = 14;
  document.querySelector("#first-due-date").valueAsDate = new Date();
  closeModal(checkinModal);
  saveAndRender();
});

taskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(taskForm);
  const title = String(formData.get("title")).trim();
  const labelsInput = String(formData.get("labels") || "").trim();

  if (!title) {
    return;
  }

  // Parse labels
  const labels = labelsInput ? labelsInput.split(',').map(label => label.trim()).filter(label => label.length > 0) : [];

  const newTask = {
    id: crypto.randomUUID(),
    title,
    labels,
    createdDate: new Date().toISOString(),
    completed: false,
    completedDate: null,
  };

  tasks.unshift(newTask);
  taskForm.reset();
  closeModal(taskModal);
  saveAndRender();
});


// Swim lane functions
const getAllLabels = () => {
  const labels = new Set();
  checkins.forEach(checkin => {
    if (checkin.labels) {
      checkin.labels.forEach(label => labels.add(label));
    }
  });
  tasks.forEach(task => {
    if (task.labels) {
      task.labels.forEach(label => labels.add(label));
    }
  });
  return Array.from(labels).sort();
};

const populateLaneSelects = () => {
  const labels = getAllLabels();
  const options = ['<option value="">Select labels...</option>'];
  labels.forEach(label => {
    options.push(`<option value="${label}">${label}</option>`);
  });
  
  lane1Select.innerHTML = options.join('');
  lane2Select.innerHTML = options.join('');
};

const filterCheckinsForLane = (checkins, selectedLabels) => {
  if (!selectedLabels || selectedLabels === '') {
    return [];
  }
  
  const labels = selectedLabels.split(',').map(l => l.trim()).filter(l => l.length > 0);
  return checkins.filter(checkin => {
    if (!checkin.labels || checkin.labels.length === 0) {
      return false;
    }
    return labels.some(label => checkin.labels.includes(label));
  });
};

const renderSwimLanes = () => {
  const lane1Labels = lane1Select.value;
  const lane2Labels = lane2Select.value;
  
  const lane1Checkins = filterCheckinsForLane(checkins, lane1Labels);
  const lane2Checkins = filterCheckinsForLane(checkins, lane2Labels);
  
  // Sort checkins by priority (red > yellow > ontime) then by due date
  const sortByPriority = (a, b) => {
    const statusA = getCheckinStatus(a);
    const statusB = getCheckinStatus(b);
    
    const priorityOrder = { red: 0, yellow: 1, ontime: 2 };
    const priorityA = priorityOrder[statusA];
    const priorityB = priorityOrder[statusB];
    
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }
    
    return new Date(a.nextDueDate) - new Date(b.nextDueDate);
  };
  
  lane1Checkins.sort(sortByPriority);
  lane2Checkins.sort(sortByPriority);
  
  // Render lane 1
  lane1Container.innerHTML = '';
  if (lane1Checkins.length === 0) {
    lane1Container.innerHTML = '<p style="color: #6b7280; text-align: center; padding: 2rem;">No check-ins match selected labels</p>';
  } else {
    lane1Checkins.forEach(checkin => {
      const card = createCheckinCard(checkin);
      lane1Container.appendChild(card);
    });
  }
  
  // Render lane 2
  lane2Container.innerHTML = '';
  if (lane2Checkins.length === 0) {
    lane2Container.innerHTML = '<p style="color: #6b7280; text-align: center; padding: 2rem;">No check-ins match selected labels</p>';
  } else {
    lane2Checkins.forEach(checkin => {
      const card = createCheckinCard(checkin);
      lane2Container.appendChild(card);
    });
  }
};

// Event listeners
addCheckinBtn.addEventListener('click', () => openModal(checkinModal));
addTaskBtn.addEventListener('click', () => openModal(taskModal));
closeCheckinModal.addEventListener('click', () => closeModal(checkinModal));
closeTaskModal.addEventListener('click', () => closeModal(taskModal));
checkinsViewBtn.addEventListener('click', () => switchToView('checkins'));
tasksViewBtn.addEventListener('click', () => switchToView('tasks'));
lane1Select.addEventListener('change', renderSwimLanes);
lane2Select.addEventListener('change', renderSwimLanes);

// Modal close on outside click
window.addEventListener('click', (event) => {
  if (event.target === checkinModal) {
    closeModal(checkinModal);
  }
  if (event.target === taskModal) {
    closeModal(taskModal);
  }
});

// Search functionality
searchInput.addEventListener('input', (event) => {
  searchTerm = event.target.value.toLowerCase();
  render();
});

// Import/Export event listeners
importBtn.addEventListener('click', () => importFile.click());
exportBtn.addEventListener('click', exportData);
importFile.addEventListener('change', importData);

// Initialize
const setDefaultDate = () => {
  const today = new Date();
  const dateInput = document.querySelector("#first-due-date");
  dateInput.valueAsDate = today;
};

const initialize = () => {
  checkins = loadCheckins();
  tasks = loadTasks();
  setDefaultDate();
  populateLaneSelects();
  render();
};

initialize();
