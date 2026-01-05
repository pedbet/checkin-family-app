const CHECKINS_STORAGE_KEY = "checkin-items";
const TASKS_STORAGE_KEY = "task-items";

// DOM Elements
const checkinForm = document.querySelector("#checkin-form");
const taskForm = document.querySelector("#task-form");
const checkinsContainer = document.querySelector("#checkins");
const tasksContainer = document.querySelector("#tasks");
const checkinTemplate = document.querySelector("#checkin-template");
const taskTemplate = document.querySelector("#task-template");
const statusFilter = document.querySelector("#status-filter");
const timeFilter = document.querySelector("#time-filter");
const taskStatusFilter = document.querySelector("#task-status-filter");
const taskLabelFilter = document.querySelector("#task-label-filter");
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
const checkinsSection = document.querySelector("#checkins-section");
const tasksSection = document.querySelector("#tasks-section");

// Import/Export
const importBtn = document.querySelector("#import-btn");
const exportBtn = document.querySelector("#export-btn");
const importFile = document.querySelector("#import-file");

// State
let currentView = "checkins";
let checkins = [];
let tasks = [];
let searchTerm = "";

// Undo system
let actionHistory = [];
const MAX_HISTORY_SIZE = 50;

// Action types
const ACTION_TYPES = {
  ADD_CHECKIN: 'add_checkin',
  ADD_TASK: 'add_task',
  COMPLETE_CHECKIN: 'complete_checkin',
  COMPLETE_TASK: 'complete_task',
  DELETE_CHECKIN: 'delete_checkin',
  DELETE_TASK: 'delete_task'
};

// Undo functions
const addAction = (action) => {
  actionHistory.push(action);
  if (actionHistory.length > MAX_HISTORY_SIZE) {
    actionHistory.shift();
  }
  updateUndoButton();
};

const updateUndoButton = () => {
  const undoBtn = document.querySelector("#undo-btn");
  if (actionHistory.length > 0) {
    const lastAction = actionHistory[actionHistory.length - 1];
    undoBtn.textContent = `↶ Undo ${lastAction.description}`;
    undoBtn.disabled = false;
  } else {
    undoBtn.textContent = "↶ Undo";
    undoBtn.disabled = true;
  }
};

const undoLastAction = () => {
  if (actionHistory.length === 0) return;
  
  const action = actionHistory.pop();
  
  switch (action.type) {
    case ACTION_TYPES.ADD_CHECKIN:
      checkins = checkins.filter(c => c.id !== action.itemId);
      break;
    case ACTION_TYPES.ADD_TASK:
      tasks = tasks.filter(t => t.id !== action.itemId);
      break;
    case ACTION_TYPES.COMPLETE_CHECKIN:
      const checkin = checkins.find(c => c.id === action.itemId);
      if (checkin) {
        checkin.lastCheckInDate = action.previousState.lastCheckInDate;
        checkin.nextDueDate = action.previousState.nextDueDate;
      }
      break;
    case ACTION_TYPES.COMPLETE_TASK:
      const task = tasks.find(t => t.id === action.itemId);
      if (task) {
        task.completed = action.previousState.completed;
        task.completedDate = action.previousState.completedDate;
      }
      break;
    case ACTION_TYPES.DELETE_CHECKIN:
      checkins.push(action.previousState);
      break;
    case ACTION_TYPES.DELETE_TASK:
      tasks.push(action.previousState);
      break;
  }
  
  saveAndRender();
  updateUndoButton();
};

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

const buildCheckinCard = (checkin) => {
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
    // Store previous state for undo
    const previousState = {
      lastCheckInDate: checkin.lastCheckInDate,
      nextDueDate: checkin.nextDueDate
    };
    
    checkin.lastCheckInDate = new Date().toISOString();
    checkin.nextDueDate = addInterval(
      new Date(),
      checkin.frequencyValue,
      checkin.frequencyUnit,
    ).toISOString();
    
    addAction({
      type: ACTION_TYPES.COMPLETE_CHECKIN,
      itemId: checkin.id,
      description: `check-in "${checkin.title}"`,
      previousState
    });
    
    saveAndRender();
  });

  deleteButton.addEventListener("click", () => {
    const previousState = { ...checkin };
    checkins = checkins.filter((item) => item.id !== checkin.id);
    
    addAction({
      type: ACTION_TYPES.DELETE_CHECKIN,
      itemId: checkin.id,
      description: `delete check-in "${checkin.title}"`,
      previousState
    });
    
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
      // Store previous state for undo
      const previousState = {
        completed: task.completed,
        completedDate: task.completedDate
      };
      
      task.completed = true;
      task.completedDate = new Date().toISOString();
      
      addAction({
        type: ACTION_TYPES.COMPLETE_TASK,
        itemId: task.id,
        description: `complete task "${task.title}"`,
        previousState
      });
      
      saveAndRender();
    }
  });

  deleteButton.addEventListener("click", () => {
    const previousState = { ...task };
    tasks = tasks.filter((item) => item.id !== task.id);
    
    addAction({
      type: ACTION_TYPES.DELETE_TASK,
      itemId: task.id,
      description: `delete task "${task.title}"`,
      previousState
    });
    
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
  // Only update task label filter (check-in label filter removed)
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
  console.log("renderCheckins called");
  checkinsContainer.innerHTML = "";
  updateLabelFilters();
  
  const filteredCheckins = filterCheckins();
  console.log("Filtered checkins:", filteredCheckins.length);
  
  if (filteredCheckins.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = checkins.length === 0 
      ? "No check-ins yet. Add your first recurring check-in."
      : "No check-ins match the current filters.";
    empty.classList.add("helper");
    checkinsContainer.appendChild(empty);
    return;
  }

  // Create swim lanes
  const swimLanesContainer = document.createElement("div");
  swimLanesContainer.className = "swim-lanes";
  
  // Default to showing "All check-ins" and top label, or two top labels
  const topLabels = getTopLabels(filteredCheckins, 1);
  const defaultLabels = ["All check-ins"];
  
  if (topLabels.length > 0) {
    defaultLabels.push(topLabels[0]);
  }
  
  // If we still don't have 2 lanes, add unlabeled
  if (defaultLabels.length < 2) {
    defaultLabels.push("Unlabeled");
  }
  
  console.log("Default labels for lanes:", defaultLabels);
  
  defaultLabels.forEach((label, index) => {
    const lane = document.createElement("div");
    lane.className = "swim-lane";
    
    const header = document.createElement("div");
    header.className = "swim-lane-header";
    
    const title = document.createElement("h3");
    title.className = "swim-lane-title";
    title.textContent = label;
    
    const dropdown = document.createElement("select");
    dropdown.className = "swim-lane-dropdown";
    dropdown.dataset.laneIndex = index;
    
    const allLabels = ["All check-ins", ...getUniqueLabels(checkins), "Unlabeled"];
    console.log("Available labels for dropdown:", allLabels);
    
    allLabels.forEach(l => {
      const option = document.createElement("option");
      option.value = l === "All check-ins" ? "all" : (l === "Unlabeled" ? "" : l);
      option.textContent = l;
      option.selected = l === label;
      dropdown.appendChild(option);
    });
    
    dropdown.addEventListener("change", (e) => {
      console.log("Swim lane dropdown changed:", e.target.value, "Lane index:", index);
      renderCheckins();
    });
    
    header.appendChild(title);
    header.appendChild(dropdown);
    
    const content = document.createElement("div");
    content.className = "swim-lane-content";
    
    const laneCheckins = document.createElement("div");
    laneCheckins.className = "checkins";
    
    // Filter checkins for this lane
    setTimeout(() => {
      const laneLabel = dropdown.value;
      console.log("Lane label:", laneLabel, "for lane:", label);
      let laneFiltered;
      
      if (laneLabel === "all") {
        laneFiltered = filteredCheckins;
      } else if (laneLabel === "") {
        laneFiltered = filteredCheckins.filter(checkin => 
          !checkin.labels || checkin.labels.length === 0
        );
      } else {
        laneFiltered = filteredCheckins.filter(checkin => 
          checkin.labels && checkin.labels.includes(laneLabel)
        );
      }
      
      console.log("Lane filtered count:", laneFiltered.length);
      
      // Clear and re-render this lane
      laneCheckins.innerHTML = "";
      
      // Sort and render checkins for this lane
      laneFiltered
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
          laneCheckins.appendChild(buildCheckinCard(checkin));
        });
      
      if (laneFiltered.length === 0) {
        const empty = document.createElement("p");
        empty.textContent = "No check-ins in this lane";
        empty.classList.add("helper");
        laneCheckins.appendChild(empty);
      }
    }, 0);
    
    content.appendChild(laneCheckins);
    lane.appendChild(header);
    lane.appendChild(content);
    swimLanesContainer.appendChild(lane);
  });
  
  checkinsContainer.appendChild(swimLanesContainer);
  console.log("Swim lanes rendered");
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
  console.log("Opening modal:", modal);
  modal.classList.add("show");
};

const closeModal = (modal) => {
  console.log("Closing modal:", modal);
  modal.classList.remove("show");
};

// View switcher
const switchView = (view) => {
  currentView = view;
  
  if (view === "checkins") {
    checkinsViewBtn.classList.add("active");
    tasksViewBtn.classList.remove("active");
    checkinsSection.style.display = "block";
    tasksSection.style.display = "none";
  } else {
    tasksViewBtn.classList.add("active");
    checkinsViewBtn.classList.remove("active");
    tasksSection.style.display = "block";
    checkinsSection.style.display = "none";
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

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log("DOM loaded, setting up event listeners...");
  
  // Event listeners with debugging
  console.log("addCheckinBtn:", addCheckinBtn);
  console.log("addTaskBtn:", addTaskBtn);
  console.log("checkinModal:", checkinModal);
  console.log("taskModal:", taskModal);

  if (addCheckinBtn) {
    addCheckinBtn.addEventListener("click", () => {
      console.log("Add checkin button clicked");
      openModal(checkinModal);
    });
  } else {
    console.error("addCheckinBtn not found!");
  }

  if (addTaskBtn) {
    addTaskBtn.addEventListener("click", () => {
      console.log("Add task button clicked");
      openModal(taskModal);
    });
  } else {
    console.error("addTaskBtn not found!");
  }

  if (closeCheckinModal) {
    closeCheckinModal.addEventListener("click", () => closeModal(checkinModal));
  }

  if (closeTaskModal) {
    closeTaskModal.addEventListener("click", () => closeModal(taskModal));
  }

  if (checkinsViewBtn) {
    checkinsViewBtn.addEventListener("click", () => switchView("checkins"));
  }

  if (tasksViewBtn) {
    tasksViewBtn.addEventListener("click", () => switchView("tasks"));
  }

  // Undo button
  const undoBtn = document.querySelector("#undo-btn");
  if (undoBtn) {
    undoBtn.addEventListener("click", undoLastAction);
  }

  if (exportBtn) {
    exportBtn.addEventListener("click", exportData);
  }

  if (importBtn) {
    importBtn.addEventListener("click", () => importFile.click());
  }

  if (importFile) {
    importFile.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) {
        importData(file);
      }
      e.target.value = ""; // Reset file input
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchTerm = e.target.value;
      render();
    });
  }

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
  if (checkinForm) {
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
      
      addAction({
        type: ACTION_TYPES.ADD_CHECKIN,
        itemId: newCheckin.id,
        description: `add check-in "${title}"`
      });
      
      checkinForm.reset();
      document.querySelector("#frequency-value").value = 1;
      document.querySelector("#frequency-unit").value = "months";
      document.querySelector("#yellow-threshold").value = 14;
      document.querySelector("#red-threshold").value = 14;
      document.querySelector("#first-due-date").valueAsDate = new Date();
      closeModal(checkinModal);
      saveAndRender();
    });
  }

  if (taskForm) {
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
      
      addAction({
        type: ACTION_TYPES.ADD_TASK,
        itemId: newTask.id,
        description: `add task "${title}"`
      });
      
      taskForm.reset();
      closeModal(taskModal);
      saveAndRender();
    });
  }

  // Filter event listeners
  if (statusFilter) {
    statusFilter.addEventListener('change', renderCheckins);
  }
  if (timeFilter) {
    timeFilter.addEventListener('change', renderCheckins);
  }
  if (taskStatusFilter) {
    taskStatusFilter.addEventListener('change', renderTasks);
  }
  if (taskLabelFilter) {
    taskLabelFilter.addEventListener('change', renderTasks);
  }

  // Initialize
  const setDefaultDate = () => {
    const today = new Date();
    const dateInput = document.querySelector("#first-due-date");
    if (dateInput) {
      dateInput.valueAsDate = today;
    }
  };

  const initialize = () => {
    checkins = loadCheckins();
    tasks = loadTasks();
    setDefaultDate();
    render();
  };

  initialize();
});