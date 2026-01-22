document.addEventListener("DOMContentLoaded", () => {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }
  const dropdowns = document.querySelectorAll("[data-dropdown]");
  const menuButton = document.querySelector(".menu-lines");
  const modal = document.getElementById("menu-modal");
  const backdrop = document.querySelector(".modal-backdrop");
  const modalCloseButtons = document.querySelectorAll("[data-modal-close]");
  const courseQuery = document.getElementById("course-query");
  const courseSearch = document.getElementById("course-search");
  const courseResults = document.getElementById("course-results");
  const savedScorecardsList = document.getElementById("saved-scorecards");
  const activeScorecardsList = document.getElementById("active-scorecards");
  const confirmModal = document.getElementById("confirm-modal");
  const confirmMessage = document.getElementById("confirm-message");
  const confirmYes = document.getElementById("confirm-yes");
  const confirmNo = document.getElementById("confirm-no");
  const confirmBackdrop = document.getElementById("confirm-backdrop");
  let pendingDeleteId = null;
  let pendingDeleteType = null;

  const COURSE_API_KEY = "VHZADXHERZ6NBNXUX2R5QZURX4";
  const COURSE_API_URL = "https://api.golfcourseapi.com/v1/search";
  const manualCourses = Array.isArray(window.manualCourses)
    ? window.manualCourses
    : [];
  const urlParams = new URLSearchParams(window.location.search);
  const courseNameParam = urlParams.get("name") || "Scorecard";
  const savedId = urlParams.get("savedId");
  const isReadOnly = urlParams.get("readonly") === "1";
  const isFresh = urlParams.get("fresh") === "1";
  const holesParam = urlParams.get("holes");

  dropdowns.forEach((dropdown) => {
    const toggle = dropdown.querySelector(".section-toggle");
    if (!toggle) return;

    toggle.addEventListener("click", () => {
      const isOpen = dropdown.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(isOpen));
    });
  });

  const setModalOpen = (isOpen) => {
    if (!modal || !backdrop || !menuButton) return;
    modal.classList.toggle("is-open", isOpen);
    backdrop.classList.toggle("is-open", isOpen);
    modal.setAttribute("aria-hidden", String(!isOpen));
    menuButton.setAttribute("aria-expanded", String(isOpen));
  };

  if (menuButton) {
    menuButton.addEventListener("click", () => {
      const isOpen = !modal.classList.contains("is-open");
      setModalOpen(isOpen);
    });
  }

  modalCloseButtons.forEach((btn) => {
    btn.addEventListener("click", () => setModalOpen(false));
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setModalOpen(false);
  });

  const renderResults = (items) => {
    if (!courseResults) return;
    if (!items || items.length === 0) {
      courseResults.innerHTML =
        '<div class="result-item">No courses found.</div>';
      return;
    }
    courseResults.innerHTML = items
      .map((course) => {
        const name = course.course_name || course.club_name || "Unknown Course";
        const address = course.location?.address || "";
        const meta = [address].filter(Boolean).join(" - ");
        const encodedName = encodeURIComponent(name);
        const encodedAddress = encodeURIComponent(address);
        return `
          <div class="result-item">
            <div class="result-main">
              ${name}
              ${meta ? `<small>${meta}</small>` : ""}
            </div>
            <a class="result-action" href="course-play.html?name=${encodedName}&address=${encodedAddress}&fresh=1">Play</a>
          </div>
        `;
      })
      .join("");
  };

  const normalize = (value) => (value || "").toLowerCase().trim();

  const mergeCourses = (apiItems, manualItems, query) => {
    const queryText = normalize(query);
    const filteredManual = manualItems.filter((course) => {
      if (!queryText) return true;
      const name = normalize(course.course_name || course.club_name);
      const address = normalize(course.location?.address);
      return name.includes(queryText) || address.includes(queryText);
    });

    const combined = [...apiItems, ...filteredManual];
    const byName = new Map();

    combined.forEach((course) => {
      const name = normalize(course.course_name || course.club_name);
      if (!name) return;
      const existing = byName.get(name);
      if (!existing) {
        byName.set(name, course);
        return;
      }

      const existingAddress = existing.location?.address || "";
      const nextAddress = course.location?.address || "";
      if (!existingAddress || (nextAddress && nextAddress.length > existingAddress.length)) {
        byName.set(name, course);
      }
    });

    return Array.from(byName.values());
  };

  const getSavedScorecards = () => {
    try {
      const raw = localStorage.getItem("savedScorecards");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  };

  const setSavedScorecards = (items) => {
    localStorage.setItem("savedScorecards", JSON.stringify(items));
  };



  const getActiveRounds = () => {
    try {
      const raw = localStorage.getItem("activeRounds");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  };

  const setActiveRounds = (items) => {
    localStorage.setItem("activeRounds", JSON.stringify(items));
  };

  const getActiveScorecards = () => getActiveRounds();

  const renderActiveScorecards = () => {
    if (!activeScorecardsList) return;
    const items = getActiveScorecards();
    if (!items.length) {
      activeScorecardsList.innerHTML =
        '<div class="result-item">No active scorecards yet.</div>';
      return;
    }
    activeScorecardsList.innerHTML = items
      .map((card) => {
        const name = card.name || "Scorecard";
        const holes = card.holes || "18";
        return `
          <div class="result-item">
            <div class="result-main">
              ${name}
              <small>In progress</small>
            </div>
            <div class="result-actions">
              <a class="result-action" href="scorecard.html?name=${encodeURIComponent(name)}&holes=${encodeURIComponent(holes)}">Resume</a>
              <button class="result-action danger" type="button" data-remove-active="${card.id}">Remove</button>
            </div>
          </div>
        `;
      })
      .join("");
  };

  const getSavedById = (id) => {
    if (!id) return null;
    return getSavedScorecards().find((card) => String(card.id) === String(id)) || null;
  };

  const renderSavedScorecards = () => {
    if (!savedScorecardsList) return;
    const items = getSavedScorecards();
    if (!items.length) {
      savedScorecardsList.innerHTML =
        '<div class="result-item">No saved scorecards yet.</div>';
      return;
    }
    savedScorecardsList.innerHTML = items
      .map((card) => {
        const name = card.name || "Scorecard";
        const totalPar = Number(card.totalPar || 0);
        const totalScore = Number(card.totalScore || 0);
        return `
          <div class="result-item">
            <div class="result-main">
              ${name}
              <small>Par ${totalPar} · Score ${totalScore}</small>
            </div>
            <div class="result-actions">
              <a class="result-action" href="saved-score-view.html?savedId=${card.id}&readonly=1&name=${encodeURIComponent(name)}">View</a>
              <button class="result-action danger" type="button" data-remove-id="${card.id}">Remove</button>
            </div>
          </div>
        `;
      })
      .join("");
  };

  const openConfirmModal = (id, name, type) => {
    if (!confirmModal) return;
    pendingDeleteId = id;
    pendingDeleteType = type;
    if (confirmMessage) {
      confirmMessage.textContent = `Are you sure you want to remove "${name}"?`;
    }
    confirmModal.classList.add("is-open");
    if (confirmBackdrop) confirmBackdrop.classList.add("is-open");
  };

  const closeConfirmModal = () => {
    if (!confirmModal) return;
    confirmModal.classList.remove("is-open");
    if (confirmBackdrop) confirmBackdrop.classList.remove("is-open");
    pendingDeleteId = null;
    pendingDeleteType = null;
  };

  const searchCourses = async () => {
    if (!courseQuery || !courseResults) return;
    const query = courseQuery.value.trim();
    if (!query) {
      courseResults.innerHTML =
        '<div class="result-item">Type a course name to search.</div>';
      return;
    }
    courseResults.innerHTML = '<div class="result-item">Searching...</div>';

    try {
      const url = `${COURSE_API_URL}?search_query=${encodeURIComponent(query)}`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Key ${COURSE_API_KEY}`,
        },
      });
      if (!response.ok) throw new Error("Request failed");
      const data = await response.json();
      const items = data.courses || data.data || data.results || [];
      renderResults(mergeCourses(items, manualCourses, query));
    } catch (err) {
      const manualOnly = mergeCourses([], manualCourses, query);
      if (manualOnly.length > 0) {
        renderResults(manualOnly);
      } else {
        courseResults.innerHTML =
          '<div class="result-item">Unable to fetch courses. Check API key or endpoint.</div>';
      }
    }
  };

  if (courseSearch) {
    courseSearch.addEventListener("click", searchCourses);
  }
  if (courseQuery) {
    courseQuery.addEventListener("keydown", (event) => {
      if (event.key === "Enter") searchCourses();
    });
  }

  renderSavedScorecards();
  renderActiveScorecards();

  if (savedScorecardsList) {
    savedScorecardsList.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const id = target.getAttribute("data-remove-id");
      if (!id) return;
      const card = getSavedById(id);
      if (card) {
        openConfirmModal(id, card.name || "Scorecard", "saved");
      }
    });
  }

  if (activeScorecardsList) {
    activeScorecardsList.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const id = target.getAttribute("data-remove-active");
      if (!id) return;
      const items = getActiveRounds();
      const card = items.find((round) => String(round.id) === String(id));
      openConfirmModal(id, card?.name || "Scorecard", "active");
    });
  }

  if (confirmYes) {
    confirmYes.addEventListener("click", () => {
      if (!pendingDeleteId) return;
      if (pendingDeleteType === "saved") {
        const items = getSavedScorecards().filter(
          (card) => String(card.id) !== String(pendingDeleteId)
        );
        setSavedScorecards(items);
        renderSavedScorecards();
      }
      if (pendingDeleteType === "active") {
        const items = getActiveRounds().filter(
          (round) => String(round.id) !== String(pendingDeleteId)
        );
        setActiveRounds(items);
        renderActiveScorecards();
      }
      closeConfirmModal();
    });
  }

  if (confirmNo) {
    confirmNo.addEventListener("click", closeConfirmModal);
  }
  if (confirmBackdrop) {
    confirmBackdrop.addEventListener("click", closeConfirmModal);
  }

  const courseTitle = document.getElementById("course-title");
  if (courseTitle) {
    courseTitle.textContent = `Course Name: ${courseNameParam}`;
    document.title = `Course Name: ${courseNameParam}`;
  }

  const scorecardGrid = document.getElementById("scorecard-grid");
  const scorecardTitle = document.querySelector(".scorecard-title");
  const scorecardPrev = document.getElementById("scorecard-prev");
  const scorecardNext = document.getElementById("scorecard-next");
  const scorecardEditPar = document.getElementById("scorecard-edit-par");
  const scorecardFinished = document.getElementById("scorecard-finished");
  const courseNameInput = document.getElementById("course-name-input");
  const courseHolesInput = document.getElementById("course-holes-input");
  const courseTeeInput = document.getElementById("course-tee-input");
  const courseSave = document.getElementById("course-save");
  const courseCancel = document.getElementById("course-cancel");
  let currentStart = 1;
  let parEditEnabled = false;
  let holeCount = 18;
  const scorecardKey = () => `scorecard:${courseNameParam}`;
  const parsKey = () => `pars:${courseNameParam}`;

  const loadScorecard = () => {
    try {
      const raw = localStorage.getItem(scorecardKey());
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  };

  const saveScorecard = (data) => {
    localStorage.setItem(scorecardKey(), JSON.stringify(data));
  };

  const loadPars = () => {
    try {
      const raw = localStorage.getItem(parsKey());
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  };

  const savePars = (data) => {
    localStorage.setItem(parsKey(), JSON.stringify(data));
  };

  const getCourseDetails = () => {
    try {
      const raw = localStorage.getItem("courseDetails");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  };

  const saveCourseDetails = (items) => {
    localStorage.setItem("courseDetails", JSON.stringify(items));
  };

  const getCourseDetailByName = (name) => {
    const items = getCourseDetails();
    return items.find((course) => course.name === name) || null;
  };

  const resetScoresKeepPars = () => {
    const pars = loadPars();
    const resetData = {};
    Object.keys(pars).forEach((hole) => {
      resetData[hole] = { par: pars[hole] };
    });
    saveScorecard(resetData);
  };

  const renderScorecard = () => {
    if (!scorecardGrid || !scorecardTitle) return;
    const end = Math.min(currentStart + 8, holeCount);
    scorecardTitle.textContent = `Holes ${currentStart}-${end}`;
    const savedData = savedId ? (getSavedById(savedId)?.holes || {}) : loadScorecard();
    const savedPars = loadPars();
    const rows = Array.from({ length: end - currentStart + 1 }, (_, idx) => {
      const holeNumber = currentStart + idx;
      const parFromSaved = savedPars?.[holeNumber];
      const parValue = savedData?.[holeNumber]?.par ?? parFromSaved ?? "";
      const scoreValue = savedData?.[holeNumber]?.score ?? "";
      const disabledAttr = isReadOnly ? "disabled" : "";
      const parLockAttr = parFromSaved ? "readonly" : "";
      const parClass = parFromSaved ? "par-locked" : "";
      return `
        <div class="hole-card">
          <h4>Hole ${holeNumber}</h4>
          <input type="number" min="1" placeholder="Par" aria-label="Par for hole ${holeNumber}" data-hole="${holeNumber}" data-field="par" value="${parValue}" class="${parClass}" ${disabledAttr} ${parLockAttr} />
          <input type="number" min="1" placeholder="Score" aria-label="Score for hole ${holeNumber}" data-hole="${holeNumber}" data-field="score" value="${scoreValue}" ${disabledAttr} />
        </div>
      `;
    }).join("");

    scorecardGrid.innerHTML = `
      <div class="hole-header">
        <div>Hole</div>
        <div>Par</div>
        <div>Score</div>
      </div>
      ${rows}
      <div class="hole-total">
        <div>Total</div>
        <div></div>
        <div class="score-total" id="scorecard-total">0</div>
      </div>
    `;
    applyParEditState(savedPars);
    updateScorecardTotal(savedData);
    if (scorecardPrev) scorecardPrev.disabled = currentStart === 1;
    if (scorecardNext) scorecardNext.disabled = holeCount <= 9 || currentStart >= 10;
  };

  const applyParEditState = (savedPars) => {
    if (!scorecardGrid) return;
    const parInputs = scorecardGrid.querySelectorAll('input[data-field="par"]');
    parInputs.forEach((input) => {
      const hole = input.getAttribute("data-hole");
      const hasSaved = savedPars?.[hole] != null && savedPars?.[hole] !== "";
      if (isReadOnly) {
        input.disabled = true;
        return;
      }
      if (parEditEnabled) {
        input.readOnly = false;
        input.classList.remove("par-locked");
        input.classList.add("par-editing");
      } else {
        input.readOnly = hasSaved;
        input.classList.toggle("par-locked", hasSaved);
        input.classList.remove("par-editing");
      }
    });
  };

  const updateScorecardTotal = (savedData) => {
    const totalEl = document.getElementById("scorecard-total");
    if (!totalEl) return;
    let total = 0;
    const end = Math.min(currentStart + 8, holeCount);
    for (let hole = currentStart; hole <= end; hole += 1) {
      const value = Number(savedData?.[hole]?.score);
      if (!Number.isNaN(value)) total += value;
    }
    totalEl.textContent = String(total);
  };

  if (scorecardPrev && scorecardNext && scorecardGrid) {
    if (isFresh && !isReadOnly) {
      resetScoresKeepPars();
    }
    if (savedId) {
      const savedCard = getSavedById(savedId);
      const savedCount = savedCard?.holeCount || Object.keys(savedCard?.holes || {}).length;
      holeCount = Number(savedCount || 18);
    } else if (holesParam) {
      holeCount = Number(holesParam) === 9 ? 9 : 18;
    } else {
      const activeRound = getActiveRounds().find((round) => round.name === courseNameParam);
      const details = getCourseDetailByName(courseNameParam);
      holeCount = Number(activeRound?.holes || details?.holes || 18);
    }
    scorecardPrev.addEventListener("click", () => {
      currentStart = 1;
      renderScorecard();
    });
    scorecardNext.addEventListener("click", () => {
      if (holeCount > 9) {
        currentStart = 10;
      }
      renderScorecard();
    });
    if (!isReadOnly) {
      scorecardGrid.addEventListener("input", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement)) return;
        const hole = Number(target.dataset.hole);
        const field = target.dataset.field;
        if (!hole || !field) return;
        const data = loadScorecard();
        data[hole] = data[hole] || {};
        data[hole][field] = target.value;
        saveScorecard(data);
        updateScorecardTotal(data);
      });
    }
    renderScorecard();
  }

  if (scorecardEditPar && !isReadOnly) {
    scorecardEditPar.addEventListener("click", () => {
      parEditEnabled = !parEditEnabled;
      scorecardEditPar.textContent = parEditEnabled ? "Done" : "Edit Par";
      applyParEditState(loadPars());
    });
  }

  if (courseCancel) {
    courseCancel.addEventListener("click", () => history.back());
  }

  if (courseSave) {
    courseSave.addEventListener("click", () => {
      const name = courseNameInput?.value.trim();
      const holes = courseHolesInput?.value || "18";
      const tee = courseTeeInput?.value || "Men";
      if (!name) return;
      const items = getCourseDetails();
      const next = {
        id: Date.now(),
        name,
        holes,
        tee,
      };
      items.unshift(next);
      saveCourseDetails(items);
      const active = getActiveRounds().filter((round) => round.name !== name);
      active.unshift({
        id: Date.now(),
        name,
        holes,
        tee,
        startedAt: Date.now(),
      });
      setActiveRounds(active);
      const nextUrl = `scorecard.html?name=${encodeURIComponent(name)}&holes=${encodeURIComponent(holes)}`;
      window.location.href = nextUrl;
    });
  }

  if (scorecardFinished) {
    if (isReadOnly) {
      scorecardFinished.disabled = true;
    } else {
      scorecardFinished.addEventListener("click", () => {
        const data = loadScorecard();
        const pars = {};
        let totalPar = 0;
        let totalScore = 0;
        for (let hole = 1; hole <= holeCount; hole += 1) {
          const parVal = Number(data?.[hole]?.par);
          const scoreVal = Number(data?.[hole]?.score);
          if (!Number.isNaN(parVal)) {
            totalPar += parVal;
            pars[hole] = data?.[hole]?.par;
          }
          if (!Number.isNaN(scoreVal)) totalScore += scoreVal;
        }
        savePars(pars);
        const savedCards = getSavedScorecards();
        const newCard = {
          id: Date.now(),
          name: courseNameParam,
          holeCount,
          totalPar,
          totalScore,
          holes: data,
        };
        savedCards.unshift(newCard);
        setSavedScorecards(savedCards);
        renderSavedScorecards();
        const active = getActiveRounds().filter((round) => round.name !== courseNameParam);
        setActiveRounds(active);
        renderActiveScorecards();
        const resetData = {};
        Object.keys(pars).forEach((hole) => {
          resetData[hole] = { par: pars[hole] };
        });
        saveScorecard(resetData);
        scorecardFinished.textContent = "Saved";
      });
    }
  }
});

