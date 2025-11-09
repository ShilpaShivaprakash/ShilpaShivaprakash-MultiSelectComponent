export const createSmartSelect = (options = {}) => {
  const config = createConfig(options)
  const state = createState(config, options.items || [])
  const dom = createDom(config.root, config)
  const emit = createEmitter(dom.control)

  function renderAll(query = "") {
    renderState(dom, state)
    renderSelectedBar(dom, state, toggleSelect)
    renderList(dom, state, config, query, toggleSelect)
  }

  function openDropdown() {
    if (state.isOpen) return
    state.isOpen = true
    positionDropdown(dom)
    dom.dropdown.classList.add("visible")
    dom.control.classList.add("is-open")
    dom.searchInput.focus()
    emit("open", {})
  }

  function closeDropdown() {
    if (!state.isOpen) return
    state.isOpen = false
    dom.dropdown.classList.remove("visible")
    dom.control.classList.remove("is-open")
    emit("close", {})
  }

  function toggleDropdown() {
    if (state.isOpen) {
      closeDropdown()
    } else {
      openDropdown()
    }
  }

  function emitChange() {
    const ids = Array.from(state.selected)
    const items = state.items
      .filter(i => state.selected.has(i.id))
      .map(i => i.raw)

    if (config.onChange) {
      config.onChange(items)
    }
    
    emit("change", { value: ids, items })
  }

  function toggleSelect(id) {
    if (!id) return

    const picked = state.selected.has(id)

    if (config.multi) {
      if (picked) {
        state.selected.delete(id)
      } else {
        state.selected.add(id)
      }
    } else {
      state.selected.clear()
      state.selected.add(id)
      closeDropdown()
    }

    renderState(dom, state)
    renderSelectedBar(dom, state, toggleSelect)
    syncListSelection(dom, state)
    emitChange()
  }

  function clearSelection() {
    if (!state.selected.size) return
    state.selected.clear()
    renderState(dom, state)
    renderSelectedBar(dom, state, toggleSelect)
    syncListSelection(dom, state)
    emitChange()
  }

  function applyFilter(term) {
    const query = term.trim().toLowerCase()

    state.filtered = query
      ? state.items.filter(item => {
        const values = [
          item.id,
          item.label,
          item.subtitle || ""
        ].map(v => String(v).toLowerCase())
        return values.some(v => v.includes(query))
      })
      : [...state.items]

    renderList(dom, state, config, query, toggleSelect)
    emit("search", { query })
  }

  bindEvents({
    dom,
    state,
    toggleDropdown,
    toggleSelect,
    clearSelection,
    applyFilter,
    closeDropdown
  })

  renderAll("")

  return {
    setItems: items => {
      const next = state.normalize(items || [])
      state.items = next
      state.filtered = [...next]
      state.selected.clear()
      renderAll("")
      emitChange()
    },
    clearSelection,
    openDropdown,
    closeDropdown,
    toggleDropdown,
    get value() {
      return Array.from(state.selected)
    },
    set value(ids) {
      state.selected.clear()
      if (Array.isArray(ids)) {
        ids.forEach(id => {
          if (state.items.some(i => i.id === id)) {
            state.selected.add(id)
          }
        })
      }
      renderState(dom, state)
      renderSelectedBar(dom, state, toggleSelect)
      syncListSelection(dom, state)
      emitChange()
    }
  }
}

const createConfig = options => {
  const {
    root,
    label = "Smart Select",
    placeholder = "Select",
    multi = true,
    getId = item => String(item.id),
    getLabel = item => String(item.label),
    getSubtitle = () => "",
    getMeta = () => ({}),
    onChange
  } = options

  if (!root) {
    throw new Error("SmartSelect: root is required")
  }

  return {
    root,
    label,
    placeholder,
    multi,
    getId,
    getLabel,
    getSubtitle,
    getMeta,
    onChange: typeof onChange === "function" ? onChange : null
  }
}

const createState = (config, items) => {
  const normalize = data =>
    (Array.isArray(data) ? data : [])
      .map(item => ({
        id: config.getId(item),
        label: config.getLabel(item),
        subtitle: config.getSubtitle(item),
        meta: config.getMeta(item),
        raw: item
      }))
      .filter(i => i.id && i.label)

  const all = normalize(items)

  return {
    items: all,
    filtered: [...all],
    selected: new Set(),
    activeIndex: -1,
    isOpen: false,
    normalize
  }
}

const el = (tag, className, text) => {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (typeof text === "string") node.textContent = text
  return node
}

const createDom = (root, config) => {
  root.innerHTML = ""

  const wrapper = el("div", "smart-select")
  const labelEl = el("label", "smart-select-label", config.label)

  const control = el("div", "smart-select-control")
  control.tabIndex = 0

  const placeholder = el("span", "smart-select-placeholder", config.placeholder)
  const summary = el("span", "smart-select-summary")

  const clearBtn = el("button", "smart-select-clear", "x")
  clearBtn.type = "button"

  const arrow = el("span", "smart-select-arrow", "▾")

  control.appendChild(placeholder)
  control.appendChild(summary)
  control.appendChild(clearBtn)
  control.appendChild(arrow)

  const selectedBar = el("div", "smart-select-selected-bar")

  const dropdown = el("div", "smart-select-dropdown")

  const searchRow = el("div", "smart-select-search-row")
  const searchInput = el("input", "smart-select-search-input")
  searchInput.type = "text"
  searchInput.placeholder = "Search"

  const searchClear = el("button", "smart-select-search-clear", "x")
  searchClear.type = "button"

  searchRow.appendChild(searchInput)
  searchRow.appendChild(searchClear)

  const list = el("div", "smart-select-list")

  dropdown.appendChild(searchRow)
  dropdown.appendChild(list)

  wrapper.appendChild(labelEl)
  wrapper.appendChild(control)
  wrapper.appendChild(selectedBar)

  document.body.appendChild(dropdown)
  root.appendChild(wrapper)

  return {
    wrapper,
    control,
    placeholder,
    summary,
    clearBtn,
    dropdown,
    searchInput,
    searchClear,
    list,
    selectedBar
  }
}

const createEmitter = control => (type, detail) => {
  if (!control) return
  control.dispatchEvent(
    new CustomEvent("smart-select:" + type, {
      bubbles: true,
      detail
    })
  )
}

const renderState = (dom, state) => {
  const selected = state.items.filter(i => state.selected.has(i.id))

  if (!selected.length) {
    dom.placeholder.style.display = "inline"
    dom.summary.style.display = "none"
    dom.clearBtn.classList.remove("visible")
    return
  }

  dom.placeholder.style.display = "none"
  dom.summary.style.display = "inline-flex"
  dom.summary.innerHTML = ""

  const count = el("span", "smart-select-count-pill", String(selected.length))
  const text = document.createElement("span")
  text.textContent = "Selected"

  dom.summary.appendChild(count)
  dom.summary.appendChild(text)
  dom.clearBtn.classList.add("visible")
}

const renderSelectedBar = (dom, state, toggleSelect) => {
  const bar = dom.selectedBar
  bar.innerHTML = ""

  const selected = state.items.filter(i => state.selected.has(i.id))
  if (!selected.length) return

  selected.forEach(item => {
    const chip = el("div", "smart-select-chip")
    chip.textContent = item.label

    const remove = el("button", "smart-select-chip-remove", "x")
    remove.type = "button"
    remove.addEventListener("click", e => {
      e.stopPropagation()
      toggleSelect(item.id)
    })

    chip.appendChild(remove)
    bar.appendChild(chip)
  })
}

const highlightMatch = (text, query) => {
  const span = document.createElement("span")
  if (!query) {
    span.textContent = text
    return span
  }

  const lower = text.toLowerCase()
  const idx = lower.indexOf(query)
  if (idx === -1) {
    span.textContent = text
    return span
  }

  const before = text.slice(0, idx)
  const match = text.slice(idx, idx + query.length)
  const after = text.slice(idx + query.length)

  span.innerHTML =
    escapeHtml(before) +
    '<span class="smart-select-mark">' +
    escapeHtml(match) +
    "</span>" +
    escapeHtml(after)

  return span
}

const escapeHtml = text =>
  String(text)
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")

const renderList = (dom, state, config, query, toggleSelect) => {
  dom.list.innerHTML = ""

  if (!state.filtered.length) {
    const empty = document.createElement("div")
    empty.textContent = "No results"
    empty.style.padding = "6px"
    empty.style.color = "#6b7280"
    dom.list.appendChild(empty)
    return
  }

  state.filtered.forEach(item => {
    const row = el("div", "smart-select-item")
    row.dataset.id = item.id

    if (state.selected.has(item.id)) {
      row.classList.add("is-selected")
    }

    const checkbox = document.createElement("input")
    checkbox.type = "checkbox"
    checkbox.checked = state.selected.has(item.id)

    const labelWrap = document.createElement("div")
    labelWrap.appendChild(highlightMatch(item.label, query))

    if (item.subtitle) {
      const sub = el("span", "smart-select-subtitle", item.subtitle)
      labelWrap.appendChild(sub)
    }

    row.appendChild(checkbox)
    row.appendChild(labelWrap)

    row.addEventListener("click", e => {
      e.stopPropagation()
      toggleSelect(item.id)
    })

    dom.list.appendChild(row)
  })
}

const syncListSelection = (dom, state) => {
  const rows = Array.from(dom.list.querySelectorAll(".smart-select-item"))
  rows.forEach(row => {
    const id = row.dataset.id
    const checkbox = row.querySelector("input[type='checkbox']")
    const selected = state.selected.has(id)
    if (checkbox) {
      checkbox.checked = selected
    }
    row.classList.toggle("is-selected", selected)
  })
}

const positionDropdown = dom => {
  const rect = dom.control.getBoundingClientRect()
  const top = rect.bottom + 4 + window.scrollY
  dom.dropdown.style.minWidth = rect.width + "px"
  dom.dropdown.style.left = rect.left + "px"
  dom.dropdown.style.top = top + "px"
}

const bindEvents = ctx => {
  const {
    dom,
    state,
    toggleDropdown,
    toggleSelect,
    clearSelection,
    applyFilter,
    closeDropdown
  } = ctx

  dom.control.addEventListener("click", () => {
    toggleDropdown()
  })

  dom.control.addEventListener("keydown", event => {
    const key = event.key
    if (key === "Enter" || key === " ") {
      event.preventDefault()
      toggleDropdown()
    } else if (key === "Escape") {
      event.preventDefault()
      closeDropdown()
    }
  })

  dom.searchInput.addEventListener("input", () => {
    applyFilter(dom.searchInput.value)
  })

  dom.searchClear.addEventListener("click", event => {
    event.stopPropagation()
    dom.searchInput.value = ""
    applyFilter("")
    closeDropdown()
  })

  dom.clearBtn.addEventListener("click", event => {
    event.stopPropagation()
    clearSelection()
    closeDropdown()
  })

  document.addEventListener("click", event => {
    const path = event.composedPath()
    if (state.isOpen && !path.includes(dom.control) && !path.includes(dom.dropdown)) {
      closeDropdown()
    }
  })

  window.addEventListener("resize", () => {
    if (state.isOpen) {
      positionDropdown(dom)
    }
  })

  window.addEventListener("scroll", () => {
    if (state.isOpen) {
      positionDropdown(dom)
    }
  }, { capture: true })
}