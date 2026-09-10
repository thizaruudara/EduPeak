/**
 * EduPeak Educational Institutes & Campus Branches Manager
 * Handles LocalStorage & Supabase synchronization of Campus Branches,
 * Registration dropdown generation (disabling Coming Soon branches),
 * and Home Page directory rendering.
 */

const EDUPEAK_INSTITUTES = {
  storageKey: "edupeak_institutes_db",

  getAll() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored !== null) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn("Error parsing institutes db:", e);
    }
    return (window.EDUPEAK_DATA && window.EDUPEAK_DATA.institutes) ? window.EDUPEAK_DATA.institutes : [];
  },

  saveAll(institutesList) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(institutesList));
    } catch (e) {
      console.warn("Error saving institutes db:", e);
    }
    if (window.EDUPEAK_DATA) {
      window.EDUPEAK_DATA.institutes = institutesList;
    }
    this.populateDropdowns();
    if (typeof renderInstitutes === "function") {
      renderInstitutes();
    }
    if (window.ADMIN_CONTROLLER && typeof window.ADMIN_CONTROLLER.renderInstitutes === "function") {
      window.ADMIN_CONTROLLER.renderInstitutes();
    }
  },

  populateDropdowns() {
    const selects = document.querySelectorAll("#regInstituteSelect, #modalRegInstituteSelect, #courseInstituteSelect");
    if (!selects.length) return;

    const institutes = this.getAll();
    selects.forEach(select => {
      const currentVal = select.value;
      select.innerHTML = institutes.map(inst => {
        const isComingSoon = inst.status === "coming_soon";
        const icon = inst.icon || (isComingSoon ? (inst.hasPhysicalLocation ? "🏛️" : "🌐") : "🏫");
        const cleanName = (inst.name || "").replace(/\s*\(Coming soon\)/gi, "").replace(/\s*\(භෞතික.*?\)/gi, "");
        const label = isComingSoon 
          ? `${icon} ${cleanName} (Coming soon - Disabled)`
          : `${icon} ${cleanName} (භෞතික / දෙමුහුන් පන්ති)`;

        return `<option value="${inst.name}" ${isComingSoon ? 'disabled style="color: #94a3b8; background: #f8fafc; cursor: not-allowed;"' : 'style="font-weight: 700; color: #0f172a;"'}>${label}</option>`;
      }).join("");

      // Ensure that if the current value was disabled or coming soon, auto-select first active option!
      const activeOption = Array.from(select.options).find(opt => !opt.disabled);
      const isSelectedValid = Array.from(select.options).some(opt => opt.value === currentVal && !opt.disabled);
      if (isSelectedValid) {
        select.value = currentVal;
      } else if (activeOption) {
        activeOption.selected = true;
      }
    });
  }
};

window.EDUPEAK_INSTITUTES = EDUPEAK_INSTITUTES;

document.addEventListener("DOMContentLoaded", () => {
  EDUPEAK_INSTITUTES.populateDropdowns();
});
