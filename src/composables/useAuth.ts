import { computed } from 'vue'
import { useAuth as useClerkAuth, useUser, useClerk } from '@clerk/vue'

export function useAuth() {
  const { isSignedIn, isLoaded } = useClerkAuth()
  const { user } = useUser()
  const clerk = useClerk()

  const isAuthenticated = computed(() => isSignedIn.value)
  const loading = computed(() => !isLoaded.value)

  async function signOut() {
    await clerk.signOut()
  }

  function openSignIn() {
    clerk.openSignIn()
  }

  function openSignUp() {
    clerk.openSignUp()
  }

  return {
    user,
    loading,
    isAuthenticated,
    isSignedIn,
    signOut,
    openSignIn,
    openSignUp,
  }
}
