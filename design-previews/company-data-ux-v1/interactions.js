const addressSearch = document.querySelector('#address-search')
const suggestions = document.querySelector('#address-suggestions')
const feedback = document.querySelector('#search-feedback')
const searchInput = document.querySelector('#street')
const houseNumberInput = document.querySelector('#house-number')
const postalCodeInput = document.querySelector('#postal-code')
const cityInput = document.querySelector('#city')
const status = document.querySelector('#company-status')
const form = document.querySelector('#company-form')
const singleLocation = document.querySelector('#single-location')
const addressPanel = document.querySelector('[data-panel="address"]')
const locationsPanel = document.querySelector('[data-panel="locations"]')
const locationStep = document.querySelector('[data-step="locations"]')
const addressStep = document.querySelector('[data-step="address"]')

function showSuggestions(isVisible) {
  suggestions.classList.toggle('is-visible', isVisible)
  addressSearch.setAttribute('aria-expanded', String(isVisible))
}

addressSearch.addEventListener('input', () => {
  const hasQuery = addressSearch.value.trim().length >= 3
  showSuggestions(hasQuery)
  feedback.classList.remove('is-visible')
})

suggestions.querySelectorAll('button[data-suggestion]').forEach((button) => {
  button.addEventListener('click', () => {
    const value = button.dataset.suggestion ?? ''
    const match = value.match(/^(.+?)\s(\d+),\s(\d{4}\s?[A-Z]{2})\s(.+)$/i)
    addressSearch.value = value
    showSuggestions(false)
    feedback.classList.add('is-visible')
    if (match) {
      searchInput.value = match[1]
      houseNumberInput.value = match[2]
      postalCodeInput.value = match[3]
      cityInput.value = match[4]
    }
  })
})

function setStep(step) {
  const showLocations = step === 'locations' && !singleLocation.checked
  addressPanel.classList.toggle('is-hidden', showLocations)
  locationsPanel.classList.toggle('is-active', showLocations)
  locationsPanel.hidden = !showLocations
  addressPanel.hidden = showLocations
  addressStep.classList.toggle('is-active', !showLocations)
  locationStep.classList.toggle('is-active', showLocations)
  if (showLocations) {
    addressStep.removeAttribute('aria-current')
    locationStep.setAttribute('aria-current', 'step')
  } else {
    locationStep.removeAttribute('aria-current')
    addressStep.setAttribute('aria-current', 'step')
  }
}

addressStep.addEventListener('click', () => setStep('address'))
locationStep.addEventListener('click', () => setStep('locations'))
document.querySelector('[data-go-locations]').addEventListener('click', () => setStep('locations'))

singleLocation.addEventListener('change', () => {
  locationStep.disabled = singleLocation.checked
  if (singleLocation.checked) {
    setStep('address')
    status.textContent = 'Locatiebeheer wordt uitgeschakeld na opslaan.'
  } else {
    status.textContent = 'Wijzigingen worden pas actief na opslaan.'
  }
  status.classList.remove('is-success')
})

form.addEventListener('submit', (event) => {
  event.preventDefault()
  status.textContent = 'Bedrijfsgegevens opgeslagen.'
  status.classList.add('is-success')
  document.querySelector('.panel-badge').textContent = 'Opgeslagen'
})

document.querySelector('[data-add-location]').addEventListener('click', () => {
  status.textContent = 'In de echte pagina opent hier de locatie-modal.'
  status.classList.remove('is-success')
  setStep('locations')
})

document.addEventListener('click', (event) => {
  if (!event.target.closest('.search-card')) {
    showSuggestions(false)
  }
})
