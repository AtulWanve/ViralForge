import { Metadata } from "next"
import Link from "next/link"
import { SignupForm } from "@/components/auth/signup-form"

export const metadata: Metadata = {
  title: "Sign Up - ViralForge",
  description: "Create a new ViralForge account",
}

export default function SignupPage() {
  return (
    <div className="container flex min-h-[100dvh] w-full flex-col items-center justify-center mx-auto px-4 overflow-x-hidden">
      <Link
        href="/"
        className="absolute left-4 top-4 md:left-8 md:top-8 text-sm font-medium hover:underline"
      >
        Back
      </Link>
      <div className="mx-auto flex w-full max-w-[calc(100vw-2rem)] flex-col justify-center space-y-6 sm:w-[350px]">
        <div className="flex flex-col space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-500">
            Create an account
          </h1>
          <p className="text-sm text-muted-foreground">
            Enter your details to create your account
          </p>
        </div>
        <SignupForm />
        <p className="px-8 text-center text-sm text-muted-foreground">
          <Link
            href="/login"
            className="hover:text-brand underline underline-offset-4"
          >
            Already have an account? Sign In
          </Link>
        </p>
      </div>
    </div>
  )
}
