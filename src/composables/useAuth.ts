import { computed } from 'vue'
import { useAuth as useClerkAuth, useUser, useClerk } from '@clerk/vue'

export function useAuth() {
  const { isSignedIn, isLoaded } = useClerkAuth()
  const { user } = useUser()
  const clerk = useClerk()

  const isAuthenticated = computed(() => isSignedIn.value)
  const loading = computed(() => !isLoaded.value)

  async function signOut() {
    await clerk.value?.signOut()
  }

  function openSignIn() {
    clerk.value?.openSignIn()
  }

  function openSignUp() {
    clerk.value?.openSignUp()
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
