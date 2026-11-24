export const cloneRow = row => Object.assign({}, row)

export const defaultFilter = () => ({ mode: 'none', n: 0, dFrom: 1, dTo: 31, hFrom: 1, hTo: 24 })

export const state = {
  loaded: false,
  data: [],
  originalData: [],
  fileName: '',
  startTime: 0,
  edited: false,
  lastResults: null,
  aiReportText: '',
  aiRunning: false,
  chatHistory: [],
  chatRunning: false,
  locationLabel: '',
  eventLogItems: [],
  filter: defaultFilter(),
  charts: {},
  refChartA: null,
  refChartC: null
}
