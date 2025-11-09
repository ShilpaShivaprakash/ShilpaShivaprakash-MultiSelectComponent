export const createSmartSelect = (options = {}) => {
  const config = createConfig(options)
  const state = createState(config, options.items || [])
  const dom = createDom(config.root, config)
  const emit = createEmitter(dom.control)

  const emitChange = () => {
    const ids = Array.from(state.selected)
    const items = state.items
      .filter(item => state.selected.has(item.id))
      .map(item => item.raw)

    if (config.onChange) {
      config.onChange(items)
    }

    emit("change", { value: ids, items })
  }

  const renderState = () => {
    const selected = state.items.filter(i => state.selected.has(i.id))

    if (!selected.length) {
      dom.placeholder.style.display = "inline"
      dom.summary.style.display = "none"
      dom.clearBtn.classList.remove("visible")
    } else {
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

    syncListSelection(dom, state)
  }

  const renderSelectedBar = () => {
    const bar = dom.selectedBar
    bar.innerHTML = ""

    const selectedItems = state.items.filter(i => state.selected.has(i.id))
    if (!selectedItems.length) return

    selectedItems.forEach(item => {
      const chip = el("div", "smart-select-chip")
      chip.textContent = item.label

      const remove = el("button", "smart-select-chip-remove", "x")
      remove.type = "button"
      remove.addEventListener("click", event => {
        event.stopPropagation()
        toggleSelect(item.id)
      })

      chip.appendChild(remove)
      bar.appendChild(chip)
    })
  }

  const renderList = (query = "") => {
    const list = dom.list
    list.innerHTML = ""

    if (!state.filtered.length) {
      const empty = document.createElement("div")
      empty.textContent = "No results"
      empty.style.padding = "6px"
      empty.style.color = "#6b7280"
      list.appendChild(empty)
      return
    }

    state.filtered.forEach((item, index) => {
      const row = el("div", "smart-select-item")
      row.dataset.id = item.id

      if (state.selected.has(item.id)) {
        row.classList.add("is-selected")
      }
      if (index === state.activeIndex) {
        row.classList.add("is-active")
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

      row.addEventListener("click", event => {
        event.stopPropagation()
        toggleSelect(item.id)

        if (config.multi && state.isOpen && dom.searchInput) {
          state.activeIndex = index
          updateActiveItem(dom, state)
          dom.searchInput.focus()
        }
      })

      list.appendChild(row)
    })

    updateActiveItem(dom, state)
  }

  const openDropdown = () => {
    if (state.isOpen) return
    state.isOpen = true
    state.activeIndex = -1
    positionDropdown(dom)
    dom.dropdown.classList.add("visible")
    dom.control.classList.add("is-open")
    dom.searchInput.focus()
    updateActiveItem(dom, state)
    emit("open", {})
  }

  const closeDropdown = () => {
    if (!state.isOpen) return
    state.isOpen = false
    state.activeIndex = -1
    dom.dropdown.classList.remove("visible")
    dom.control.classList.remove("is-open")
    updateActiveItem(dom, state)
    emit("close", {})
  }

  const toggleDropdown = () => {
    if (state.isOpen) {
      closeDropdown()
    } else {
      openDropdown()
    }
  }

  const toggleSelect = id => {
    if (!id) return

    const already = state.selected.has(id)

    if (config.multi) {
      if (already) {
        state.selected.delete(id)
      } else {
        state.selected.add(id)
      }
    } else {
      state.selected.clear()
      state.selected.add(id)
      closeDropdown()
    }

    renderState()
    renderSelectedBar()
    emitChange()
  }

  const clearSelection = () => {
    if (!state.selected.size) return
    state.selected.clear()
    renderState()
    renderSelectedBar()
    emitChange()
  }

  const applyFilter = term => {
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

    state.activeIndex = -1
    renderList(query)
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

  renderList("")
  renderState()
  renderSelectedBar()

  return {
    setItems: items => {
      const next = state.normalize(items || [])
      state.items = next
      state.filtered = [...next]
      state.selected.clear()
      state.activeIndex = -1
      renderList("")
      renderState()
      renderSelectedBar()
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
      renderState()
      renderSelectedBar()
      emitChange()
    }
  }
}

/* config and state */

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
      .map((item, index) => {
        const baseId = config.getId(item)
        const id = baseId != null && baseId !== ""
          ? String(baseId)
          : "ss-" + index
        return {
          id,
          label: config.getLabel(item),
          subtitle: config.getSubtitle(item),
          meta: config.getMeta(item),
          raw: item
        }
      })
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

/* dom helpers */

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

const positionDropdown = dom => {
  const rect = dom.control.getBoundingClientRect()
  const top = rect.bottom + 4 + window.scrollY
  dom.dropdown.style.minWidth = rect.width + "px"
  dom.dropdown.style.left = rect.left + "px"
  dom.dropdown.style.top = top + "px"
}

/* events and keyboard nav */

const createEmitter = control => (type, detail) => {
  if (!control) return
  control.dispatchEvent(
    new CustomEvent("smart-select:" + type, {
      bubbles: true,
      detail
    })
  )
}

const updateActiveItem = (dom, state) => {
  const rows = Array.from(dom.list.querySelectorAll(".smart-select-item"))
  rows.forEach((row, index) => {
    if (index === state.activeIndex) {
      row.classList.add("is-active")
      row.scrollIntoView({ block: "nearest" })
    } else {
      row.classList.remove("is-active")
    }
  })
}

const moveActive = (dom, state, step) => {
  const count = state.filtered.length
  if (!count) return

  if (state.activeIndex === -1) {
    state.activeIndex = step > 0 ? 0 : count - 1
  } else {
    state.activeIndex = (state.activeIndex + step + count) % count
  }
  updateActiveItem(dom, state)
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
    } else if (key === "ArrowDown") {
      event.preventDefault()
      if (!state.isOpen) {
        toggleDropdown()
        if (state.filtered.length) {
          state.activeIndex = 0
          updateActiveItem(dom, state)
        }
      } else {
        moveActive(dom, state, 1)
      }
    } else if (key === "ArrowUp") {
      event.preventDefault()
      if (state.isOpen) {
        moveActive(dom, state, -1)
      }
    } else if (key === "Escape") {
      event.preventDefault()
      closeDropdown()
    }
  })

  dom.searchInput.addEventListener("input", () => {
    applyFilter(dom.searchInput.value)
  })

  dom.searchInput.addEventListener("keydown", event => {
    const key = event.key

    if (key === "ArrowDown") {
      event.preventDefault()
      moveActive(dom, state, 1)
    } else if (key === "ArrowUp") {
      event.preventDefault()
      moveActive(dom, state, -1)
    } else if (key === "Enter") {
      event.preventDefault()
      if (
        state.activeIndex >= 0 &&
        state.activeIndex < state.filtered.length
      ) {
        const item = state.filtered[state.activeIndex]
        toggleSelect(item.id)
      }
    } else if (key === "Escape") {
      event.preventDefault()
      closeDropdown()
    }
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
    if (
      state.isOpen &&
      !path.includes(dom.control) &&
      !path.includes(dom.dropdown)
    ) {
      closeDropdown()
    }
  })

  window.addEventListener("resize", () => {
    if (state.isOpen) {
      positionDropdown(dom)
    }
  })

  window.addEventListener(
    "scroll",
    () => {
      if (state.isOpen) {
        positionDropdown(dom)
      }
    },
    { capture: true }
  )
}

const highlightMatch = (text, query) => {
  const span = document.createElement("span")
  if (!query) {
    span.textContent = text
    return span
  }

  const source = String(text)
  const lower = source.toLowerCase()
  const q = query.toLowerCase()
  const idx = lower.indexOf(q)

  if (idx === -1) {
    span.textContent = source
    return span
  }

  const before = source.slice(0, idx)
  const match = source.slice(idx, idx + q.length)
  const after = source.slice(idx + q.length)

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
