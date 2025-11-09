import { createSmartSelect } from "../smart-select.js"

const log = (name, ok) => {
  const el = document.createElement("div")
  el.textContent = (ok ? "OK " : "FAIL ") + name
  el.style.color = ok ? "#065f46" : "#b91c1c"
  document.getElementById("results").appendChild(el)
}

const test = (name, fn) => {
  try {
    const ok = fn()
    log(name, ok)
  } catch (err) {
    console.error(err)
    log(name + " (" + err.message + ")", false)
  }
}

const click = el => {
  if (!el) return
  el.dispatchEvent(new MouseEvent("click", { bubbles: true }))
}

const input = (el, value) => {
  el.value = value
  el.dispatchEvent(new Event("input", { bubbles: true }))
}

window.addEventListener("load", () => {
  const root = document.getElementById("root")

  // Single source of demo data for tests.
  // Generic, not facility-specific naming.
  const items = [
    { id: "F1", label: "11111", type: "TAG", currency: "USD" },
    { id: "F2", label: "AA2234", type: "TAG", currency: "USD" },
    { id: "F3", label: "BBB1", type: "TAG", currency: "EUR" }
  ]

  let lastChange = null

  const api = createSmartSelect({
    root,
    label: "Smart Select Test",
    placeholder: "Select",
    multi: true,
    items,
    getId: item => item.id,
    getLabel: item => item.label,
    getSubtitle: item => item.currency,
    getMeta: item => ({ type: item.type }),
    onChange: selected => {
      lastChange = selected
    }
  })

  const getControl = () => document.querySelector(".smart-select-control")
  const getDropdown = () => document.querySelector(".smart-select-dropdown")
  const getItems = () => Array.from(document.querySelectorAll(".smart-select-item"))
  const getSelectedBar = () => document.querySelector(".smart-select-selected-bar")
  const getChips = () =>
    getSelectedBar()
      ? getSelectedBar().querySelectorAll(".smart-select-chip")
      : []
  const getClearBtn = () => document.querySelector(".smart-select-clear")
  const getSearchInput = () => document.querySelector(".smart-select-search-input")
  const getSearchClear = () => document.querySelector(".smart-select-search-clear")

  // 1. Basic render

  test("renders control", () => !!getControl())
  test("renders dropdown container", () => !!getDropdown())

  // 2. Initial state

  test("initial has no selection", () => api.value.length === 0)

  test("initial shows placeholder", () => {
    const ph = document.querySelector(".smart-select-placeholder")
    return !!ph && ph.style.display !== "none"
  })

  // 3. Open dropdown

  test("dropdown opens on control click", () => {
    click(getControl())
    return getDropdown().classList.contains("visible")
  })

  // 4. No default selected item

  test("no default selected row", () => {
    const anySelected = getItems().some(row => row.classList.contains("is-selected"))
    return !anySelected
  })

  // 5. Select first item

  test("clicking item selects it and shows one chip", () => {
    const first = getItems()[0]
    click(first)

    const values = api.value
    const hasValue = values.length === 1 && values[0] === "F1"

    const chips = getChips()
    const hasChip = chips.length === 1 && chips[0].textContent.trim().startsWith("11111")

    const onChangeOk =
      Array.isArray(lastChange) &&
      lastChange.length === 1 &&
      lastChange[0].id === "F1"

    return hasValue && hasChip && onChangeOk
  })

  // 6. Multi select: select second item as well

  test("can select multiple values", () => {
    // Dropdown is still open for multi select after first click.
    // If implementation closes it, we reopen safely.
    if (!getDropdown().classList.contains("visible")) {
      click(getControl())
    }

    const second = getItems()[1]
    click(second)

    const values = api.value.slice().sort()
    const chips = getChips()

    const hasTwoValues =
      values.length === 2 &&
      values[0] === "F1" &&
      values[1] === "F2"

    const hasTwoChips = chips.length === 2

    return hasTwoValues && hasTwoChips
  })

  // 7. Remove one via chip X

  test("removing via chip X updates selection", () => {
    const chips = getChips()
    if (!chips.length) return false

    const firstRemove = chips[0].querySelector(".smart-select-chip-remove")
    click(firstRemove)

    const values = api.value
    const chipsAfter = getChips()

    return values.length === 1 && chipsAfter.length === 1
  })

  // 8. Clear all via main X, closes dropdown

  test("clear button clears all and closes dropdown", () => {
    // Ensure something selected first
    if (api.value.length === 0) {
      click(getControl())
      click(getItems()[0])
    }

    if (!getDropdown().classList.contains("visible")) {
      click(getControl())
    }

    const clearBtn = getClearBtn()
    click(clearBtn)

    const empty = api.value.length === 0
    const closed = !getDropdown().classList.contains("visible")

    return empty && closed
  })

  // 9. Search filters results

  test("search input filters list", () => {
    click(getControl())

    const search = getSearchInput()
    if (!search) return false

    input(search, "BBB1")

    const listItems = getItems()
    return (
      listItems.length === 1 &&
      listItems[0].dataset.id === "F3"
    )
  })

  // 10. Search clear resets and closes

  test("search clear resets and closes dropdown", () => {
    const sc = getSearchClear()
    if (!sc) return false

    click(sc)

    const dropdownVisible = getDropdown().classList.contains("visible")
    const searchEmpty = getSearchInput().value === ""

    return !dropdownVisible && searchEmpty
  })

  // 11. Custom events: open and change

  test("fires smart-select:open and smart-select:change", () => {
    let openFired = false
    let changeFired = false

    const control = getControl()

    const handleOpen = () => {
      openFired = true
      control.removeEventListener("smart-select:open", handleOpen)
    }

    const handleChange = () => {
      changeFired = true
      control.removeEventListener("smart-select:change", handleChange)
    }

    control.addEventListener("smart-select:open", handleOpen)
    control.addEventListener("smart-select:change", handleChange)

    click(control)          // open
    const first = getItems()[0]
    click(first)            // select

    return openFired && changeFired
  })
})