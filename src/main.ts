import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { clerkPlugin } from '@clerk/vue'
import router from './router'
import App from './App.vue'
import './style.css'

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

const app = createApp(App)

app.use(createPinia())
app.use(clerkPlugin, { publishableKey: clerkPublishableKey })
app.use(router)

app.mount('#app')
