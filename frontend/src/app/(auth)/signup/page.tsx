import { redirect } from 'next/navigation'

/** Public signups are disabled. Redirect to login. */
export default function SignupPage() {
  redirect('/login')
}
