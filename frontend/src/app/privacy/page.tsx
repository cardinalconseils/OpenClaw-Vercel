import type { Metadata } from 'next'
import { LegalPageLayout } from '@/components/legal/legal-page-layout'

export const metadata: Metadata = {
  title: 'Privacy Policy — Murphy',
  description:
    'How Cardinal Conseils collects, uses, and protects your personal data when you use Murphy.',
}

const LAST_UPDATED = 'March 17, 2026'

const TOC_SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'data-collected', label: 'Data We Collect' },
  { id: 'how-we-use', label: 'How We Use Your Data' },
  { id: 'third-parties', label: 'Third-Party Services' },
  { id: 'data-retention', label: 'Data Retention' },
  { id: 'your-rights', label: 'Your Rights' },
  { id: 'tcpa', label: 'Telephone and SMS Consent' },
  { id: 'can-spam', label: 'Email Communications' },
  { id: 'security', label: 'Data Security' },
  { id: 'contact', label: 'Contact Us' },
]

export default function PrivacyPage() {
  return (
    <LegalPageLayout
      sections={TOC_SECTIONS}
      title="Privacy Policy"
      lastUpdated={LAST_UPDATED}
    >
      {/* Overview */}
      <section id="overview">
        <h2 className="font-display font-bold text-2xl text-foreground mt-10 mb-4" id="overview">
          Overview
        </h2>
        <p className="font-sans text-sm leading-7 text-muted-foreground mb-4">
          Cardinal Conseils ("we", "us", "our") operates Murphy, an AI-powered phone concierge
          service accessible at murphy.help and via our toll-free phone number. Murphy finds and
          connects callers with local service providers — plumbers, electricians, cleaners, and
          more — through a single phone call.
        </p>
        <p className="font-sans text-sm leading-7 text-muted-foreground mb-4">
          This Privacy Policy describes how we collect, use, disclose, and protect information
          about you when you visit murphy.help or interact with the Murphy phone service. By using
          Murphy, you consent to the practices described in this policy.
        </p>
        <p className="font-sans text-sm leading-7 text-muted-foreground mb-4">
          If you have questions or concerns about this policy, please contact us at{' '}
          <a href="mailto:info@cardinalconseils.com" className="text-primary hover:underline">
            info@cardinalconseils.com
          </a>
          .
        </p>
      </section>

      {/* Data We Collect */}
      <section id="data-collected">
        <h2 className="font-display font-bold text-2xl text-foreground mt-10 mb-4" id="data-collected">
          Data We Collect
        </h2>
        <p className="font-sans text-sm leading-7 text-muted-foreground mb-4">
          We collect information that you provide directly, information collected automatically
          when you use the service, and information from third-party sources.
        </p>

        <h3 className="font-sans font-bold text-base text-foreground mt-6 mb-2">
          Information You Provide
        </h3>
        <ul className="list-disc pl-6 space-y-2 mb-4">
          <li className="font-sans text-sm leading-7 text-muted-foreground">
            <strong>Phone number</strong> — captured automatically from your caller ID when you call Murphy
          </li>
          <li className="font-sans text-sm leading-7 text-muted-foreground">
            <strong>Your name</strong> — shared verbally during the call and transcribed by our AI
          </li>
          <li className="font-sans text-sm leading-7 text-muted-foreground">
            <strong>Service requests</strong> — descriptions of the service you need, transcribed from your speech
          </li>
          <li className="font-sans text-sm leading-7 text-muted-foreground">
            <strong>Account email</strong> — if you register for a murphy.help account
          </li>
          <li className="font-sans text-sm leading-7 text-muted-foreground">
            <strong>Approximate location</strong> — inferred from your verbal description or IP address, used to search nearby providers
          </li>
        </ul>

        <h3 className="font-sans font-bold text-base text-foreground mt-6 mb-2">
          Information Collected Automatically
        </h3>
        <ul className="list-disc pl-6 space-y-2 mb-4">
          <li className="font-sans text-sm leading-7 text-muted-foreground">
            <strong>Call recordings</strong> — audio recordings of your calls, retained for quality assurance and AI improvement (see Data Retention below)
          </li>
          <li className="font-sans text-sm leading-7 text-muted-foreground">
            <strong>Call metadata</strong> — timestamps, call duration, provider call outcomes
          </li>
          <li className="font-sans text-sm leading-7 text-muted-foreground">
            <strong>Server logs</strong> — IP addresses, browser type, and request metadata collected by our hosting provider
          </li>
          <li className="font-sans text-sm leading-7 text-muted-foreground">
            <strong>Mission records</strong> — structured records of completed service-matching sessions stored in our database
          </li>
        </ul>
      </section>

      {/* How We Use Your Data */}
      <section id="how-we-use">
        <h2 className="font-display font-bold text-2xl text-foreground mt-10 mb-4" id="how-we-use">
          How We Use Your Data
        </h2>
        <p className="font-sans text-sm leading-7 text-muted-foreground mb-4">
          We use the information we collect for the following purposes:
        </p>
        <ul className="list-disc pl-6 space-y-2 mb-4">
          <li className="font-sans text-sm leading-7 text-muted-foreground">
            <strong>Service matching</strong> — searching Google Places and other sources to find local service providers that match your request
          </li>
          <li className="font-sans text-sm leading-7 text-muted-foreground">
            <strong>Outbound calling</strong> — placing automated calls to service providers on your behalf to check availability and facilitate a live connection
          </li>
          <li className="font-sans text-sm leading-7 text-muted-foreground">
            <strong>SMS recaps</strong> — sending you a text message summary of your service match, including provider contact information and a tip link (with your consent under TCPA)
          </li>
          <li className="font-sans text-sm leading-7 text-muted-foreground">
            <strong>Service improvement</strong> — analyzing transcripts and call outcomes to improve AI accuracy and service quality
          </li>
          <li className="font-sans text-sm leading-7 text-muted-foreground">
            <strong>Account management</strong> — if you have a registered account, managing your profile, call history, and settings
          </li>
          <li className="font-sans text-sm leading-7 text-muted-foreground">
            <strong>Legal compliance</strong> — fulfilling our obligations under applicable law, including TCPA, PIPEDA, and CCPA
          </li>
        </ul>
        <p className="font-sans text-sm leading-7 text-muted-foreground mb-4">
          We do not sell your personal information to third parties. We do not use your data for
          advertising or marketing purposes beyond the scope of the Murphy service.
        </p>
      </section>

      {/* Third-Party Services */}
      <section id="third-parties">
        <h2 className="font-display font-bold text-2xl text-foreground mt-10 mb-4" id="third-parties">
          Third-Party Services
        </h2>
        <p className="font-sans text-sm leading-7 text-muted-foreground mb-4">
          Murphy relies on the following third-party services to deliver the phone concierge
          experience. Each service may process some of your data as described:
        </p>

        <h3 className="font-sans font-bold text-base text-foreground mt-6 mb-2">Telnyx</h3>
        <p className="font-sans text-sm leading-7 text-muted-foreground mb-4">
          Telnyx powers Murphy&apos;s voice and SMS infrastructure. When you call Murphy, Telnyx
          processes your phone number, call audio (for real-time speech-to-text transcription),
          and call recordings. Telnyx may retain call data per their own data retention policies.
          See{' '}
          <a
            href="https://telnyx.com/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Telnyx Privacy Policy
          </a>
          .
        </p>

        <h3 className="font-sans font-bold text-base text-foreground mt-6 mb-2">Supabase</h3>
        <p className="font-sans text-sm leading-7 text-muted-foreground mb-4">
          Supabase provides our PostgreSQL database and authentication infrastructure. Your account
          data (email, hashed password), call history, and mission records are stored in Supabase.
          Data is encrypted at rest. See{' '}
          <a
            href="https://supabase.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Supabase Privacy Policy
          </a>
          .
        </p>

        <h3 className="font-sans font-bold text-base text-foreground mt-6 mb-2">
          Google Places API
        </h3>
        <p className="font-sans text-sm leading-7 text-muted-foreground mb-4">
          Murphy uses the Google Places API to search for local service providers. We send your
          service type and approximate location to Google to retrieve provider listings. We do not
          send your name, phone number, or any personally identifiable information to Google. See{' '}
          <a
            href="https://policies.google.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Google Privacy Policy
          </a>
          .
        </p>

        <h3 className="font-sans font-bold text-base text-foreground mt-6 mb-2">
          OpenRouter / Anthropic
        </h3>
        <p className="font-sans text-sm leading-7 text-muted-foreground mb-4">
          Murphy uses OpenRouter and Anthropic to power AI language processing. Transcribed speech
          from your calls is sent to these providers to generate responses, plan service-matching
          missions, and draft SMS summaries. These providers do not persistently store your
          conversations for their own purposes (beyond transient API processing). See{' '}
          <a
            href="https://openrouter.ai/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            OpenRouter Privacy Policy
          </a>{' '}
          and{' '}
          <a
            href="https://www.anthropic.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Anthropic Privacy Policy
          </a>
          .
        </p>

        <h3 className="font-sans font-bold text-base text-foreground mt-6 mb-2">BuyMeACoffee</h3>
        <p className="font-sans text-sm leading-7 text-muted-foreground mb-4">
          After a successful service match, Murphy sends you an SMS containing a BuyMeACoffee tip
          link. We share no user data with BuyMeACoffee. If you choose to tip, BuyMeACoffee
          processes your payment under their own terms. Tipping is entirely voluntary. See{' '}
          <a
            href="https://www.buymeacoffee.com/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            BuyMeACoffee Privacy Policy
          </a>
          .
        </p>

        <h3 className="font-sans font-bold text-base text-foreground mt-6 mb-2">Vercel</h3>
        <p className="font-sans text-sm leading-7 text-muted-foreground mb-4">
          The murphy.help website and API are hosted on Vercel. Vercel collects server logs
          including IP addresses, request paths, and response metadata. These logs are used for
          performance monitoring and security. See{' '}
          <a
            href="https://vercel.com/legal/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Vercel Privacy Policy
          </a>
          .
        </p>
      </section>

      {/* Data Retention */}
      <section id="data-retention">
        <h2 className="font-display font-bold text-2xl text-foreground mt-10 mb-4" id="data-retention">
          Data Retention
        </h2>
        <ul className="list-disc pl-6 space-y-2 mb-4">
          <li className="font-sans text-sm leading-7 text-muted-foreground">
            <strong>Call history and mission records</strong> — retained for the lifetime of your account
          </li>
          <li className="font-sans text-sm leading-7 text-muted-foreground">
            <strong>Call recordings</strong> — retained for 90 days, then automatically deleted
          </li>
          <li className="font-sans text-sm leading-7 text-muted-foreground">
            <strong>Account data</strong> — retained until you request account deletion
          </li>
          <li className="font-sans text-sm leading-7 text-muted-foreground">
            <strong>Account deletion</strong> — upon request, all associated personal data is removed within 30 days
          </li>
        </ul>
        <p className="font-sans text-sm leading-7 text-muted-foreground mb-4">
          Anonymized, aggregated data may be retained indefinitely for service improvement and
          analytics. This data cannot be linked back to any individual.
        </p>
      </section>

      {/* Your Rights */}
      <section id="your-rights">
        <h2 className="font-display font-bold text-2xl text-foreground mt-10 mb-4" id="your-rights">
          Your Rights
        </h2>

        <h3 className="font-sans font-bold text-base text-foreground mt-6 mb-2">
          California Residents — CCPA Rights
        </h3>
        <p className="font-sans text-sm leading-7 text-muted-foreground mb-4">
          Under the California Consumer Privacy Act (CCPA), California residents have the
          following rights:
        </p>
        <ul className="list-disc pl-6 space-y-2 mb-4">
          <li className="font-sans text-sm leading-7 text-muted-foreground">
            <strong>Right to Know</strong> — request disclosure of the personal information we have collected about you, the categories of sources, and the purposes for which it is used
          </li>
          <li className="font-sans text-sm leading-7 text-muted-foreground">
            <strong>Right to Delete</strong> — request deletion of your personal information, subject to certain exceptions
          </li>
          <li className="font-sans text-sm leading-7 text-muted-foreground">
            <strong>Right to Opt-Out of Sale</strong> — we do not sell your personal information, so this right is not applicable, but we affirm this commitment
          </li>
          <li className="font-sans text-sm leading-7 text-muted-foreground">
            <strong>Right to Non-Discrimination</strong> — we will not discriminate against you for exercising your CCPA rights
          </li>
        </ul>

        <h3 className="font-sans font-bold text-base text-foreground mt-6 mb-2">
          Canadian Residents — PIPEDA Rights
        </h3>
        <p className="font-sans text-sm leading-7 text-muted-foreground mb-4">
          Under the Personal Information Protection and Electronic Documents Act (PIPEDA), Canadian
          residents have the following rights:
        </p>
        <ul className="list-disc pl-6 space-y-2 mb-4">
          <li className="font-sans text-sm leading-7 text-muted-foreground">
            <strong>Right to Access</strong> — request access to personal information we hold about you
          </li>
          <li className="font-sans text-sm leading-7 text-muted-foreground">
            <strong>Right to Correct</strong> — request correction of inaccurate personal information
          </li>
          <li className="font-sans text-sm leading-7 text-muted-foreground">
            <strong>Right to Withdraw Consent</strong> — withdraw consent for the collection or use of your personal information, subject to legal or contractual obligations
          </li>
        </ul>

        <h3 className="font-sans font-bold text-base text-foreground mt-6 mb-2">
          How to Exercise Your Rights
        </h3>
        <p className="font-sans text-sm leading-7 text-muted-foreground mb-4">
          To exercise any of the above rights, please email us at{' '}
          <a href="mailto:info@cardinalconseils.com" className="text-primary hover:underline">
            info@cardinalconseils.com
          </a>{' '}
          with the subject line &quot;Privacy Request&quot; and a description of your request. We will
          respond within 30 days.
        </p>
      </section>

      {/* Telephone and SMS Consent — TCPA */}
      <section id="tcpa">
        <h2 className="font-display font-bold text-2xl text-foreground mt-10 mb-4" id="tcpa">
          Telephone and SMS Consent
        </h2>
        <p className="font-sans text-sm leading-7 text-muted-foreground mb-4">
          Murphy is subject to the Telephone Consumer Protection Act (TCPA). We take your telephone
          and messaging consent seriously.
        </p>
        <ul className="list-disc pl-6 space-y-2 mb-4">
          <li className="font-sans text-sm leading-7 text-muted-foreground">
            <strong>SMS consent</strong> — before sending you an SMS recap, Murphy asks for your verbal consent during the call. We only send SMS messages to callers who have explicitly agreed.
          </li>
          <li className="font-sans text-sm leading-7 text-muted-foreground">
            <strong>Opt-out</strong> — you may opt out of SMS messages at any time by replying <strong>STOP</strong> to any message from Murphy. You will receive a confirmation and no further messages will be sent.
          </li>
          <li className="font-sans text-sm leading-7 text-muted-foreground">
            <strong>Outbound calls</strong> — Murphy places automated outbound calls to service providers only on your behalf, after you have initiated a call and requested a service match. Murphy does not place telemarketing calls or cold calls to consumers.
          </li>
          <li className="font-sans text-sm leading-7 text-muted-foreground">
            <strong>No harassment</strong> — we do not use auto-dialers for consumer outreach. All outbound consumer communication is either directly responsive to your inbound call or sent with prior express consent.
          </li>
        </ul>
      </section>

      {/* Email Communications — CAN-SPAM */}
      <section id="can-spam">
        <h2 className="font-display font-bold text-2xl text-foreground mt-10 mb-4" id="can-spam">
          Email Communications
        </h2>
        <p className="font-sans text-sm leading-7 text-muted-foreground mb-4">
          Murphy&apos;s email communications are governed by the CAN-SPAM Act (US) and Canada&apos;s
          Anti-Spam Legislation (CASL).
        </p>
        <ul className="list-disc pl-6 space-y-2 mb-4">
          <li className="font-sans text-sm leading-7 text-muted-foreground">
            <strong>Transactional emails only</strong> — we send service emails such as account confirmations, password resets, and important notices. We do not send commercial marketing email.
          </li>
          <li className="font-sans text-sm leading-7 text-muted-foreground">
            <strong>No unsolicited email</strong> — Murphy does not purchase email lists or send promotional emails to individuals who have not registered for an account.
          </li>
          <li className="font-sans text-sm leading-7 text-muted-foreground">
            <strong>Unsubscribe</strong> — every email we send includes an unsubscribe mechanism. You may also email{' '}
            <a href="mailto:info@cardinalconseils.com" className="text-primary hover:underline">
              info@cardinalconseils.com
            </a>{' '}
            to opt out of any email communications.
          </li>
          <li className="font-sans text-sm leading-7 text-muted-foreground">
            <strong>Sender identification</strong> — all emails clearly identify Cardinal Conseils as the sender and include our contact information.
          </li>
        </ul>
      </section>

      {/* Data Security */}
      <section id="security">
        <h2 className="font-display font-bold text-2xl text-foreground mt-10 mb-4" id="security">
          Data Security
        </h2>
        <p className="font-sans text-sm leading-7 text-muted-foreground mb-4">
          We take reasonable technical and organizational measures to protect your personal
          information from unauthorized access, loss, misuse, or disclosure:
        </p>
        <ul className="list-disc pl-6 space-y-2 mb-4">
          <li className="font-sans text-sm leading-7 text-muted-foreground">
            <strong>Encryption at rest</strong> — all data stored in our Supabase database is encrypted at rest using AES-256
          </li>
          <li className="font-sans text-sm leading-7 text-muted-foreground">
            <strong>TLS in transit</strong> — all data transmitted between your browser, our servers, and third-party APIs is encrypted using TLS 1.2 or higher
          </li>
          <li className="font-sans text-sm leading-7 text-muted-foreground">
            <strong>Access controls</strong> — access to personal data is limited to authorized personnel and service accounts that need it to operate the service
          </li>
          <li className="font-sans text-sm leading-7 text-muted-foreground">
            <strong>No plain-text passwords</strong> — we never store passwords in plain text; passwords are hashed using industry-standard algorithms
          </li>
          <li className="font-sans text-sm leading-7 text-muted-foreground">
            <strong>Row-level security</strong> — our database enforces row-level security policies so users can only access their own data
          </li>
        </ul>
        <p className="font-sans text-sm leading-7 text-muted-foreground mb-4">
          No method of electronic transmission or storage is 100% secure. While we strive to use
          commercially acceptable means to protect your personal information, we cannot guarantee
          its absolute security.
        </p>
      </section>

      {/* Contact Us */}
      <section id="contact">
        <h2 className="font-display font-bold text-2xl text-foreground mt-10 mb-4" id="contact">
          Contact Us
        </h2>
        <p className="font-sans text-sm leading-7 text-muted-foreground mb-4">
          If you have any questions about this Privacy Policy, your personal data, or want to
          exercise your privacy rights, please contact:
        </p>
        <p className="font-sans text-sm leading-7 text-muted-foreground mb-4">
          <strong>Cardinal Conseils</strong>
          <br />
          Privacy Inquiries
          <br />
          <a href="mailto:info@cardinalconseils.com" className="text-primary hover:underline">
            info@cardinalconseils.com
          </a>
        </p>
        <p className="font-sans text-sm leading-7 text-muted-foreground mb-4">
          We aim to respond to all privacy inquiries within 30 business days.
        </p>
      </section>
    </LegalPageLayout>
  )
}
