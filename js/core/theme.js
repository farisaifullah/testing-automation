import { $ } from './dom.js'

const KEY = 'srm-theme'

const readStored = () => {
  try {
    return localStorage.getItem(KEY)
  } catch (err) {
    return null
  }
}

const writeStored = value => {
  try {
    localStorage.setItem(KEY, value)
  } catch (err) {
    /* storage unavailable, theme just won't persist */
  }
}

export function initTheme () {
  let theme = readStored()
  if (theme !== 'dark' && theme !== 'light') theme = 'light'

  const apply = value => {
    document.documentElement.setAttribute('data-theme', value)
    const btn = $('btnTheme')
    btn.setAttribute('aria-checked', String(value === 'dark'))
    btn.title = value === 'dark' ? 'Beralih ke mode terang' : 'Beralih ke mode gelap'
  }

  apply(theme)
  $('btnTheme').addEventListener('click', () => {
    theme = theme === 'dark' ? 'light' : 'dark'
    writeStored(theme)
    apply(theme)
  })
}
