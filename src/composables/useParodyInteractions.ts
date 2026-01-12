import { ref, computed } from 'vue'
import type { Product, Fee, Popup, EasterEgg, PopupTrigger } from '../types'

export interface CartItem {
  product: Product
  quantity: number
}

// Fallback popups when AI doesn't generate custom ones for these triggers
const FALLBACK_POPUPS: Record<string, Popup> = {
  search_click: {
    id: 'search_fallback',
    trigger: 'search_click',
    title: '🔍 Search Feature',
    message: "We already know what you want. We've been watching. But sure, type something anyway.",
    icon: '👁️',
    buttons: [
      { label: 'I accept my fate', primary: true },
      { label: 'This is fine', primary: false }
    ]
  },
  cart_click: {
    id: 'cart_fallback',
    trigger: 'cart_click',
    title: '🛒 Your Cart of Regret',
    message: "Items in your cart are judging your life choices. They've formed a support group.",
    icon: '💸',
    buttons: [
      { label: 'Add more regrets', primary: true },
      { label: 'Face consequences', primary: false }
    ]
  },
  nav_click: {
    id: 'nav_fallback',
    trigger: 'nav_click',
    title: '🧭 Navigation',
    message: "You want to go somewhere else? After everything we've been through? Fine. But we'll remember this.",
    icon: '😢',
    buttons: [
      { label: 'Stay here forever', primary: true },
      { label: 'Leave anyway', primary: false }
    ]
  },
  logo_click: {
    id: 'logo_fallback',
    trigger: 'logo_click',
    title: '🏠 Home Sweet Home',
    message: "Clicking the logo to escape? Classic. We've added 3 items to your cart for trying.",
    icon: '🏃',
    buttons: [
      { label: 'Accept punishment', primary: true }
    ]
  }
}

export function useParodyInteractions() {
  // Cart state
  const cartItems = ref<CartItem[]>([])
  const cartOpen = ref(false)

  // Fees state - fees can be added dynamically
  const activeFees = ref<Fee[]>([])
  const feeAnimating = ref(false)

  // Popup state
  const activePopup = ref<Popup | null>(null)
  const popupVisible = ref(false)
  const triggeredPopups = ref<Set<string>>(new Set())

  // Easter egg state
  const logoClickCount = ref(0)
  const easterEggMessage = ref('')
  const showEasterEgg = ref(false)
  const glitchMode = ref(false)

  // Scroll tracking
  const scrolledToBottom = ref(false)
  const scrolled50 = ref(false)

  // Computed
  const cartTotal = computed(() => {
    const subtotal = cartItems.value.reduce((sum, item) => sum + item.product.price * item.quantity, 0)
    const feesTotal = activeFees.value.reduce((sum, fee) => sum + fee.amount, 0)
    return subtotal + feesTotal
  })

  const cartItemCount = computed(() =>
    cartItems.value.reduce((sum, item) => sum + item.quantity, 0)
  )

  // Cart actions
  function addToCart(product: Product) {
    const existing = cartItems.value.find(item => item.product.id === product.id)
    if (existing) {
      existing.quantity++
    } else {
      cartItems.value.push({ product, quantity: 1 })
    }
    // Trigger add_to_cart popup
    triggerPopup('add_to_cart')
  }

  function removeFromCart(productId: string) {
    const index = cartItems.value.findIndex(item => item.product.id === productId)
    if (index > -1) {
      cartItems.value.splice(index, 1)
    }
  }

  function clearCart() {
    cartItems.value = []
  }

  // Fee actions
  function addFee(fee: Fee) {
    // Check if fee already exists
    if (!activeFees.value.find(f => f.name === fee.name)) {
      feeAnimating.value = true
      activeFees.value.push(fee)
      setTimeout(() => {
        feeAnimating.value = false
      }, 500)
    }
  }

  function initializeFees(fees: Fee[]) {
    activeFees.value = [...fees]
  }

  // Popup actions
  function triggerPopup(trigger: PopupTrigger, popups?: Popup[]) {
    // Find matching popup that hasn't been triggered (from AI-generated popups)
    const aiPopup = popups?.find(p =>
      p.trigger === trigger && !triggeredPopups.value.has(p.id)
    )

    if (aiPopup) {
      activePopup.value = aiPopup
      popupVisible.value = true
      triggeredPopups.value.add(aiPopup.id)
      return
    }

    // Fall back to hardcoded funny messages for interactive elements
    const fallback = FALLBACK_POPUPS[trigger]
    if (fallback && !triggeredPopups.value.has(fallback.id)) {
      activePopup.value = fallback
      popupVisible.value = true
      triggeredPopups.value.add(fallback.id)
    }
  }

  function closePopup() {
    popupVisible.value = false
    setTimeout(() => {
      activePopup.value = null
    }, 300)
  }

  function handlePopupButton(_buttonIndex: number) {
    // Both buttons close the popup, but we could add different behaviors
    closePopup()
  }

  // Easter egg actions
  function handleLogoClick(easterEggs?: EasterEgg[]) {
    logoClickCount.value++

    if (logoClickCount.value >= 5) {
      const egg = easterEggs?.find(e => e.trigger === 'logo_click_5x')
      if (egg) {
        triggerEasterEgg(egg)
      }
      logoClickCount.value = 0
    }
  }

  function triggerEasterEgg(egg: EasterEgg) {
    switch (egg.action) {
      case 'show_message':
        easterEggMessage.value = egg.message || 'You found a secret!'
        showEasterEgg.value = true
        setTimeout(() => {
          showEasterEgg.value = false
        }, 3000)
        break
      case 'add_fee':
        if (egg.fee) {
          addFee(egg.fee as Fee)
        }
        break
      case 'glitch':
        glitchMode.value = true
        setTimeout(() => {
          glitchMode.value = false
        }, 2000)
        break
      case 'confetti':
        // Trigger confetti animation
        triggerConfetti()
        break
    }
  }

  function triggerConfetti() {
    // Create confetti elements
    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#dfe6e9']
    for (let i = 0; i < 50; i++) {
      const confetti = document.createElement('div')
      confetti.className = 'confetti-piece'
      confetti.style.cssText = `
        position: fixed;
        width: 10px;
        height: 10px;
        background: ${colors[Math.floor(Math.random() * colors.length)]};
        left: ${Math.random() * 100}vw;
        top: -20px;
        opacity: 1;
        transform: rotate(${Math.random() * 360}deg);
        animation: confetti-fall 3s ease-out forwards;
        z-index: 9999;
        pointer-events: none;
      `
      document.body.appendChild(confetti)
      setTimeout(() => confetti.remove(), 3000)
    }
  }

  // Scroll handlers
  function handleScroll(easterEggs?: EasterEgg[], popups?: Popup[]) {
    const scrollTop = window.scrollY
    const docHeight = document.documentElement.scrollHeight
    const winHeight = window.innerHeight
    const scrollPercent = scrollTop / (docHeight - winHeight)

    // 50% scroll trigger
    if (scrollPercent >= 0.5 && !scrolled50.value) {
      scrolled50.value = true
      triggerPopup('scroll_50', popups)
    }

    // Bottom scroll trigger
    if (scrollPercent >= 0.95 && !scrolledToBottom.value) {
      scrolledToBottom.value = true
      const egg = easterEggs?.find(e => e.trigger === 'scroll_bottom')
      if (egg) {
        triggerEasterEgg(egg)
      }
    }
  }

  // Exit intent handler
  function handleMouseLeave(popups?: Popup[]) {
    triggerPopup('exit_intent', popups)
  }

  // Timer-based popup
  let timerPopupTimeout: number | null = null

  function startTimerPopup(popups?: Popup[]) {
    timerPopupTimeout = window.setTimeout(() => {
      triggerPopup('timer_10s', popups)
    }, 10000)
  }

  function stopTimerPopup() {
    if (timerPopupTimeout) {
      clearTimeout(timerPopupTimeout)
    }
  }

  // Checkout flow
  function handleCheckout(popups?: Popup[]) {
    triggerPopup('checkout', popups)
  }

  // Newsletter
  function handleNewsletter(popups?: Popup[]) {
    triggerPopup('newsletter', popups)
  }

  return {
    // Cart
    cartItems,
    cartOpen,
    cartTotal,
    cartItemCount,
    addToCart,
    removeFromCart,
    clearCart,

    // Fees
    activeFees,
    feeAnimating,
    addFee,
    initializeFees,

    // Popups
    activePopup,
    popupVisible,
    triggerPopup,
    closePopup,
    handlePopupButton,

    // Easter eggs
    logoClickCount,
    easterEggMessage,
    showEasterEgg,
    glitchMode,
    handleLogoClick,
    triggerEasterEgg,
    triggerConfetti,

    // Scroll
    scrolledToBottom,
    scrolled50,
    handleScroll,

    // Events
    handleMouseLeave,
    handleCheckout,
    handleNewsletter,
    startTimerPopup,
    stopTimerPopup,
  }
}
