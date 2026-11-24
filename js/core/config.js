export const CONFIG = {
  MAX_INV_DISPLAY: 100,
  MIN_POINTS: 6,
  VEL_FLOOR: 0.05,
  VEL_SMA_PERIOD: 3,
  VEL_FROM_DISP: false,
  WIN_EXPAND_MAX: 4,
  ONSET_TRIM_RATIO: 3,
  HORIZON_DEFAULT: 24,
  HORIZON_MAX: 24,
  WINDOW_COLORS: ['#16a34a', '#f59e0b', '#0891b2'],
  COLORS: {
    raw: '#94a3b8',
    sma: '#4f46e5',
    disp: '#4f46e5',
    vel: '#f97316',
    accel: '#94a3b8',
    accelSma: '#0891b2',
    bayesian: '#0891b2',
    danger: '#ef4444',
    grid: 'rgba(15,23,42,0.08)',
    text: '#475569'
  },
  HEADER_MAP: {
    time: ['time', 'timestamp', 'date', 'datetime', 'waktu', 'tanggal', 'jam'],
    disp: ['dispmm', 'disp', 'displacement', 'displacementmm', 'perpindahan', 'deformation', 'deformasi'],
    vel: ['velmmh', 'vel', 'velocity', 'velocitymmh', 'kecepatan'],
    inv: ['invvelhmm', 'invvel', 'inversevelocity', 'inv'],
    accel: ['accelmmh2', 'accelmmh', 'accel', 'acceleration', 'percepatan'],
    tangent: ['tangent', 'tangentdeg', 'angle', 'sudut']
  }
}

export const HEADER_KEYWORDS = {
  time: ['time', 'timestamp', 'date', 'datetime', 'waktu', 'tanggal', 'jam', 'epoch', 'unix'],
  inv: ['inverse', 'invvel', '1/v'],
  accel: ['accel', 'percepatan'],
  disp: ['disp', 'deform', 'defor', 'perpindahan', 'movement', 'settlement', 'subsidence', 'cumulative', 'los'],
  vel: ['vel', 'speed', 'rate', 'kecepatan'],
  tangent: ['tangent', 'angle', 'sudut']
}

export const KEYWORD_ORDER = ['time', 'inv', 'accel', 'disp', 'vel', 'tangent']

// PLACEHOLDER: velWarn, velDanger, invCrit, minR2 belum terverifikasi dari HTML lama.
// win1/win2/win3/horizon terverifikasi dari source code lama.
export const THRESHOLDS = {
  velWarn: 0.5,
  velDanger: 1.0,
  invCrit: 1.0,
  minR2: 0.7,
  win1: 30,
  win2: 60,
  win3: 120,
  horizon: 24
}

export const TARP = {
  1: { name: 'TARP lv 1', desc: 'Aman' },
  2: { name: 'TARP lv 2', desc: 'Waspada' },
  3: { name: 'TARP lv 3', desc: 'Siaga' },
  4: { name: 'TARP lv 4', desc: 'Awas' }
}
