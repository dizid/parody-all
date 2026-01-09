import { ref, watch, onMounted } from 'vue'

type Theme = 'dark' | 'light'

const theme = ref<Theme>('dark')

export function useTheme() {
  onMounted(() => {
    // Load saved preference or default to dark
    const saved = localStorage.getItem('theme') as Theme | null
    theme.value = saved || 'dark'
    applyTheme(theme.value)
  })

  watch(theme, (newTheme) => {
    localStorage.setItem('theme', newTheme)
    applyTheme(newTheme)
  })

  function applyTheme(t: Theme) {
    const root = document.documentElement
    if (t === 'light') {
      root.classList.add('light')
    } else {
      root.classList.remove('light')
    }
  }

  function toggleTheme() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
  }

  function setTheme(t: Theme) {
    theme.value = t
  }

  return {
    theme,
    toggleTheme,
    setTheme,
    isDark: () => theme.value === 'dark',
  }
}
